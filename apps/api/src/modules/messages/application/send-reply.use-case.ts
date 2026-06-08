import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { addDays } from "date-fns";
import { nextBusinessHour, newlinesToHtml } from "@nudge/shared";
import {
  MESSAGE_REPOSITORY,
  type MessageRepository,
  type ReplyContext,
} from "../domain/message.repository";
import {
  OUTBOUND_EMAIL_SERVICE,
  type OutboundEmailService,
} from "../domain/outbound-email.service";
import type { MessageDetail } from "../domain/message.entity";
import {
  CustomerHasNoEmailError,
  MessageNotFoundError,
  NoReplyToRespondToError,
  OutboundEmailSendError,
} from "../domain/message.errors";
import type { Env } from "../../../common/config/env.schema";

export interface SendReplyInput {
  body: string;
  resumeSequence: boolean;
}

interface ReplyEnv {
  NOTIFICATIONS_EMAIL: string;
  RESEND_INBOUND_ADDRESS: string;
}

@Injectable()
export class SendReplyUseCase {
  private readonly logger = new Logger(SendReplyUseCase.name);
  private readonly env: ReplyEnv;

  constructor(
    @Inject(MESSAGE_REPOSITORY)
    private readonly repo: MessageRepository,
    @Inject(OUTBOUND_EMAIL_SERVICE)
    private readonly email: OutboundEmailService,
    @Inject(ConfigService)
    config: ConfigService<Env, true> | ReplyEnv,
  ) {
    // Accept either the real ConfigService or a plain object so unit tests
    // can construct the use case directly without booting the Nest config layer.
    this.env =
      "get" in config && typeof config.get === "function"
        ? {
            NOTIFICATIONS_EMAIL: config.get("NOTIFICATIONS_EMAIL", { infer: true }),
            RESEND_INBOUND_ADDRESS: config.get("RESEND_INBOUND_ADDRESS", { infer: true }),
          }
        : (config as ReplyEnv);
  }

  async execute(id: string, businessId: string, input: SendReplyInput): Promise<MessageDetail> {
    const context = await this.repo.findReplyContext(id, businessId);
    if (!context) throw new MessageNotFoundError(id);
    if (context.message.repliedAt === null) {
      throw new NoReplyToRespondToError(id);
    }
    if (context.customer.contactEmail === null) {
      throw new CustomerHasNoEmailError(context.customer.id);
    }

    const subject = this.composeSubject(context.message.subject);
    const body = this.composeBody(input.body, context.business.emailSignature);
    const newMessageId = randomUUID();

    await this.repo.createReplyMessage({
      id: newMessageId,
      sequenceRunId: context.message.sequenceRunId,
      invoiceId: context.message.invoiceId,
      customerId: context.message.customerId,
      businessId: context.message.businessId,
      recipientEmail: context.customer.contactEmail,
      subject,
      body,
    });

    let externalMessageId: string;
    try {
      const result = await this.email.send({
        from: `${context.business.senderName} <${this.env.NOTIFICATIONS_EMAIL}>`,
        replyTo: this.env.RESEND_INBOUND_ADDRESS,
        to: context.customer.contactEmail,
        subject,
        html: body,
      });
      externalMessageId = result.externalMessageId;
    } catch (error) {
      throw new OutboundEmailSendError(newMessageId, error);
    }

    const sentAt = new Date();
    await this.repo.markMessageSent({
      id: newMessageId,
      businessId,
      externalMessageId,
      sentAt,
    });

    if (input.resumeSequence) {
      await this.maybeResume(context, sentAt);
    }

    const detail = await this.repo.findDetailById(newMessageId, businessId);
    if (!detail) {
      // Should never happen — we just inserted and updated it.
      throw new Error(`Reply message ${newMessageId} not found immediately after send`);
    }
    return detail;
  }

  private composeSubject(original: string | null): string {
    if (!original || original.trim().length === 0) return "Re: (no subject)";
    return original.startsWith("Re:") ? original : `Re: ${original}`;
  }

  private composeBody(body: string, signature: string | null): string {
    const html = newlinesToHtml(body);
    return signature ? `${html}<br><br>${newlinesToHtml(signature)}` : html;
  }

  private async maybeResume(context: ReplyContext, now: Date): Promise<void> {
    if (context.sequenceRun.status !== "paused") {
      this.logger.warn({
        msg: "Resume requested but run is not paused",
        event: "send_reply_resume_skipped",
        runId: context.sequenceRun.id,
        runStatus: context.sequenceRun.status,
      });
      return;
    }
    if (context.sequenceRun.currentStepId === null || context.currentStep === null) {
      this.logger.warn({
        msg: "Resume requested but run has no current step",
        event: "send_reply_resume_no_step",
        runId: context.sequenceRun.id,
      });
      return;
    }

    const target = addDays(now, context.currentStep.delayDays);
    const nextSendAt = nextBusinessHour(target, context.business.timezone);

    await this.repo.resumeRun(context.sequenceRun.id, context.message.businessId, nextSendAt);
  }
}
