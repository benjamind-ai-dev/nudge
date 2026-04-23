import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { addDays, differenceInDays, format } from "date-fns";
import { formatCents } from "@nudge/shared";
import {
  MESSAGE_SEND_REPOSITORY,
  type MessageSendRepository,
  type RunReadyToSend,
  type MessageChannel,
  type SingleChannel,
} from "../domain/message-send.repository";
import { TEMPLATE_SERVICE, type TemplateService, type TemplateData } from "../domain/template.service";
import { EMAIL_SERVICE, type EmailService } from "../domain/email.service";
import { SMS_SERVICE, type SmsService } from "../domain/sms.service";
import { nextBusinessHour } from "../../../common/utils/business-hours";
import { Env } from "../../../common/config/env.schema";

interface ChannelSendResult {
  sent: boolean;
  skippedReason?: "no_recipient" | "duplicate_race";
}

export interface SendMessageInput {
  sequenceRunId: string;
  businessId: string;
}

export interface SendMessageResult {
  sent: boolean;
  skippedReason?: string;
  messagesSent: number;
}

@Injectable()
export class SendMessageUseCase {
  private readonly logger = new Logger(SendMessageUseCase.name);

  constructor(
    @Inject(MESSAGE_SEND_REPOSITORY)
    private readonly repo: MessageSendRepository,
    @Inject(TEMPLATE_SERVICE)
    private readonly templateService: TemplateService,
    @Inject(EMAIL_SERVICE)
    private readonly emailService: EmailService,
    @Inject(SMS_SERVICE)
    private readonly smsService: SmsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async execute(input: SendMessageInput): Promise<SendMessageResult> {
    const run = await this.repo.findRunById(input.sequenceRunId, input.businessId);

    if (!run) {
      this.logger.warn({
        msg: "Run not found",
        event: "send_message_run_not_found",
        sequenceRunId: input.sequenceRunId,
        businessId: input.businessId,
      });
      return { sent: false, skippedReason: "run_not_found", messagesSent: 0 };
    }

    if (run.runStatus !== "active") {
      this.logger.debug({
        msg: "Run no longer active, skipping",
        event: "send_message_run_inactive",
        sequenceRunId: input.sequenceRunId,
        status: run.runStatus,
      });
      return { sent: false, skippedReason: "run_not_active", messagesSent: 0 };
    }

    const templateData = this.buildTemplateData(run);
    let messagesSent = 0;
    let duplicatesSkipped = 0;
    let channelsSkippedNoRecipient = 0;

    const channels = this.getChannels(run.stepChannel);

    for (const channel of channels) {
      const alreadySent = await this.repo.messageExistsForRunStep(
        run.runId,
        run.stepId,
        channel,
        run.businessId,
      );

      if (alreadySent) {
        this.logger.debug({
          msg: "Message already sent for this run/step/channel",
          event: "send_message_duplicate",
          runId: run.runId,
          stepId: run.stepId,
          channel,
        });
        duplicatesSkipped++;
        continue;
      }

      try {
        const result = await this.sendByChannel(channel, run, templateData);
        if (result.sent) {
          messagesSent++;
        } else if (result.skippedReason === "no_recipient") {
          channelsSkippedNoRecipient++;
        } else if (result.skippedReason === "duplicate_race") {
          duplicatesSkipped++;
        }
      } catch (error) {
        this.logger.error({
          msg: `Failed to send ${channel}`,
          event: "send_message_failed",
          runId: run.runId,
          channel,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    if (messagesSent === 0) {
      const skippedReason =
        duplicatesSkipped > 0 && channelsSkippedNoRecipient > 0
          ? "all_skipped_mixed"
          : duplicatesSkipped > 0
            ? "all_duplicates"
            : "no_recipients";

      this.logger.warn({
        msg: "No messages sent, skipping step advancement",
        event: "send_message_all_skipped",
        runId: run.runId,
        stepId: run.stepId,
        duplicatesSkipped,
        channelsSkippedNoRecipient,
        skippedReason,
      });
      return { sent: false, skippedReason, messagesSent: 0 };
    }

    await this.advanceOrCompleteRun(run);

    this.logger.log({
      msg: "Message(s) sent successfully",
      event: "send_message_completed",
      runId: run.runId,
      invoiceNumber: run.invoiceNumber,
      messagesSent,
    });

    return { sent: true, messagesSent };
  }

  private getChannels(stepChannel: MessageChannel): SingleChannel[] {
    if (stepChannel === "email_and_sms") {
      return ["email", "sms"];
    }
    return [stepChannel];
  }

  private buildTemplateData(run: RunReadyToSend): TemplateData {
    const daysOverdue = differenceInDays(new Date(), run.dueDate);

    return {
      customer: {
        company_name: run.customerCompanyName,
        contact_name: run.customerContactName,
      },
      invoice: {
        invoice_number: run.invoiceNumber,
        amount: formatCents(run.amountCents),
        balance_due: formatCents(run.balanceDueCents),
        due_date: format(run.dueDate, "MMM d, yyyy"),
        days_overdue: Math.max(0, daysOverdue),
        payment_link: run.paymentLinkUrl,
      },
      business: {
        sender_name: run.businessSenderName,
      },
    };
  }

  private async sendByChannel(
    channel: SingleChannel,
    run: RunReadyToSend,
    templateData: TemplateData,
  ): Promise<ChannelSendResult> {
    switch (channel) {
      case "email":
        return this.sendEmail(run, templateData);
      case "sms":
        return this.sendSms(run, templateData);
      default: {
        const exhaustiveCheck: never = channel;
        throw new Error(`Unknown channel: ${exhaustiveCheck}`);
      }
    }
  }

  private async sendEmail(run: RunReadyToSend, templateData: TemplateData): Promise<ChannelSendResult> {
    const recipientEmail = run.stepIsOwnerAlert
      ? run.businessSenderEmail
      : run.customerContactEmail;

    if (!recipientEmail) {
      this.logger.warn({
        msg: "No email address available, skipping email",
        event: "send_email_no_recipient",
        runId: run.runId,
        isOwnerAlert: run.stepIsOwnerAlert,
      });
      return { sent: false, skippedReason: "no_recipient" };
    }

    const subject = run.stepSubjectTemplate
      ? this.templateService.render(`${run.stepId}-subject`, run.stepSubjectTemplate, templateData)
      : `Reminder: Invoice ${run.invoiceNumber ?? ""}`;

    let body = this.templateService.render(`${run.stepId}-body`, run.stepBodyTemplate, templateData);

    if (run.businessEmailSignature) {
      body = `${body}\n\n${run.businessEmailSignature}`;
    }

    const messageId = randomUUID();

    // Write "queued" record first to prevent double-send on retry.
    // If provider succeeds but DB update fails, retry will see the record and skip.
    const { created } = await this.repo.createMessage({
      id: messageId,
      sequenceRunId: run.runId,
      sequenceStepId: run.stepId,
      invoiceId: run.invoiceId,
      customerId: run.customerId,
      businessId: run.businessId,
      channel: "email",
      recipientEmail,
      recipientPhone: null,
      subject,
      body,
      status: "queued",
      externalMessageId: null,
      sentAt: null,
    });

    if (!created) {
      this.logger.warn({
        msg: "Message record already exists (race condition), treating as duplicate",
        event: "send_email_duplicate_race",
        runId: run.runId,
        stepId: run.stepId,
      });
      return { sent: false, skippedReason: "duplicate_race" };
    }

    const notificationsEmail = this.config.get("NOTIFICATIONS_EMAIL", { infer: true });
    const sendResult = await this.emailService.send({
      from: `${run.businessSenderName} <${notificationsEmail}>`,
      replyTo: run.businessSenderEmail,
      to: recipientEmail,
      subject,
      html: body,
    });

    await this.repo.updateMessageStatus({
      id: messageId,
      businessId: run.businessId,
      status: "sent",
      externalMessageId: sendResult.externalMessageId,
      sentAt: new Date(),
    });

    return { sent: true };
  }

  private async sendSms(run: RunReadyToSend, templateData: TemplateData): Promise<ChannelSendResult> {
    // SMS owner alerts are not supported — no business phone in the data pipeline.
    if (run.stepIsOwnerAlert) {
      this.logger.warn({
        msg: "SMS owner alerts are not supported, skipping",
        event: "send_sms_owner_alert_unsupported",
        runId: run.runId,
      });
      return { sent: false, skippedReason: "no_recipient" };
    }

    const recipientPhone = run.customerContactPhone;

    if (!recipientPhone) {
      this.logger.warn({
        msg: "No phone number available, skipping SMS",
        event: "send_sms_no_recipient",
        runId: run.runId,
      });
      return { sent: false, skippedReason: "no_recipient" };
    }

    const smsTemplate = run.stepSmsBodyTemplate ?? run.stepBodyTemplate;
    const body = this.templateService.render(`${run.stepId}-sms`, smsTemplate, templateData);
    const messageId = randomUUID();

    // Write "queued" record first to prevent double-send on retry.
    // If provider succeeds but DB update fails, retry will see the record and skip.
    const { created } = await this.repo.createMessage({
      id: messageId,
      sequenceRunId: run.runId,
      sequenceStepId: run.stepId,
      invoiceId: run.invoiceId,
      customerId: run.customerId,
      businessId: run.businessId,
      channel: "sms",
      recipientEmail: null,
      recipientPhone,
      subject: null,
      body,
      status: "queued",
      externalMessageId: null,
      sentAt: null,
    });

    if (!created) {
      this.logger.warn({
        msg: "Message record already exists (race condition), treating as duplicate",
        event: "send_sms_duplicate_race",
        runId: run.runId,
        stepId: run.stepId,
      });
      return { sent: false, skippedReason: "duplicate_race" };
    }

    const sendResult = await this.smsService.send({
      to: recipientPhone,
      body,
      businessId: run.businessId,
      invoiceId: run.invoiceId,
      sequenceStepId: run.stepId,
    });

    await this.repo.updateMessageStatus({
      id: messageId,
      businessId: run.businessId,
      status: "sent",
      externalMessageId: sendResult.externalMessageId,
      sentAt: new Date(),
    });

    return { sent: true };
  }

  private async advanceOrCompleteRun(run: RunReadyToSend): Promise<void> {
    const nextStep = await this.repo.findNextStep(run.sequenceId, run.businessId, run.stepOrder);

    if (nextStep) {
      const nextSendAt = this.calculateNextSendAt(nextStep.delayDays, run.businessTimezone);

      await this.repo.advanceRunToNextStep(run.runId, run.businessId, nextStep.id, nextSendAt);

      this.logger.debug({
        msg: "Advanced to next step",
        event: "run_advanced",
        runId: run.runId,
        nextStepId: nextStep.id,
        nextSendAt,
      });
    } else {
      await this.repo.completeRun(run.runId, run.businessId);

      this.logger.log({
        msg: "Sequence run completed",
        event: "run_completed",
        runId: run.runId,
        invoiceNumber: run.invoiceNumber,
      });
    }
  }

  private calculateNextSendAt(delayDays: number, timezone: string): Date {
    const now = new Date();
    const withDelay = addDays(now, delayDays);
    return nextBusinessHour(withDelay, timezone);
  }
}
