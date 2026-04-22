import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { addDays, differenceInDays, format } from "date-fns";
import { formatCents } from "@nudge/shared";
import {
  MESSAGE_SEND_REPOSITORY,
  type MessageSendRepository,
  type RunReadyToSend,
} from "../domain/message-send.repository";
import { TEMPLATE_SERVICE, type TemplateService, type TemplateData } from "../domain/template.service";
import { EMAIL_SERVICE, type EmailService } from "../domain/email.service";
import { SMS_SERVICE, type SmsService } from "../domain/sms.service";
import { nextBusinessHour } from "../../../common/utils/business-hours";

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

    const channels = this.getChannels(run.stepChannel);

    for (const channel of channels) {
      const alreadySent = await this.repo.messageExistsForRunStep(
        run.runId,
        run.stepId,
        channel,
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
        const sent = await this.sendByChannel(channel, run, templateData);
        if (sent) {
          messagesSent++;
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

    const allChannelsWereDuplicates = duplicatesSkipped === channels.length;

    if (allChannelsWereDuplicates) {
      this.logger.warn({
        msg: "All channels were duplicates, skipping step advancement",
        event: "send_message_all_duplicates",
        runId: run.runId,
        stepId: run.stepId,
      });
      return { sent: false, skippedReason: "all_duplicates", messagesSent: 0 };
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

  private getChannels(stepChannel: string): string[] {
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
    channel: string,
    run: RunReadyToSend,
    templateData: TemplateData,
  ): Promise<boolean> {
    if (channel === "email") {
      return this.sendEmail(run, templateData);
    } else if (channel === "sms") {
      return this.sendSms(run, templateData);
    }
    return false;
  }

  private async sendEmail(run: RunReadyToSend, templateData: TemplateData): Promise<boolean> {
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
      return false;
    }

    const subject = run.stepSubjectTemplate
      ? this.templateService.render(`${run.stepId}-subject`, run.stepSubjectTemplate, templateData)
      : `Reminder: Invoice ${run.invoiceNumber ?? ""}`;

    let body = this.templateService.render(`${run.stepId}-body`, run.stepBodyTemplate, templateData);

    if (run.businessEmailSignature) {
      body = `${body}\n\n${run.businessEmailSignature}`;
    }

    const messageId = randomUUID();

    const result = await this.emailService.send({
      from: `${run.businessSenderName} <${run.businessSenderEmail}>`,
      to: recipientEmail,
      subject,
      html: body,
    });

    await this.repo.createMessage({
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
      status: "sent",
      externalMessageId: result.externalMessageId,
      sentAt: new Date(),
    });

    return true;
  }

  private async sendSms(run: RunReadyToSend, templateData: TemplateData): Promise<boolean> {
    const recipientPhone = run.customerContactPhone;

    if (!recipientPhone) {
      this.logger.warn({
        msg: "No phone number available, skipping SMS",
        event: "send_sms_no_recipient",
        runId: run.runId,
      });
      return false;
    }

    const smsTemplate = run.stepSmsBodyTemplate ?? run.stepBodyTemplate;
    const body = this.templateService.render(`${run.stepId}-sms`, smsTemplate, templateData);
    const messageId = randomUUID();

    const result = await this.smsService.send({
      to: recipientPhone,
      body,
      businessId: run.businessId,
      invoiceId: run.invoiceId,
      sequenceStepId: run.stepId,
    });

    await this.repo.createMessage({
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
      status: "sent",
      externalMessageId: result.externalMessageId,
      sentAt: new Date(),
    });

    return true;
  }

  private async advanceOrCompleteRun(run: RunReadyToSend): Promise<void> {
    const nextStep = await this.repo.findNextStep(run.sequenceId, run.stepOrder);

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
