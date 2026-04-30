import { Inject, Injectable, Logger } from "@nestjs/common";
import { PAUSED_REASONS } from "@nudge/shared";
import {
  type ResendEventsMessageRepository,
  RESEND_EVENTS_MESSAGE_REPOSITORY,
} from "../domain/resend-events-message.repository";
import {
  type ResendEventsSequenceRunRepository,
  RESEND_EVENTS_SEQUENCE_RUN_REPOSITORY,
} from "../domain/resend-events-sequence-run.repository";
import {
  type ResendEventsBusinessRepository,
  RESEND_EVENTS_BUSINESS_REPOSITORY,
} from "../domain/resend-events-business.repository";
import {
  type EmailService,
  EMAIL_SERVICE,
} from "../../message-send/domain/email.service";

const ALERTS_FROM = "Nudge <alerts@nudge.co>";

export interface HandleEmailComplainedInput {
  externalMessageId: string;
}

@Injectable()
export class HandleEmailComplainedUseCase {
  private readonly logger = new Logger(HandleEmailComplainedUseCase.name);

  constructor(
    @Inject(RESEND_EVENTS_MESSAGE_REPOSITORY)
    private readonly messageRepo: ResendEventsMessageRepository,
    @Inject(RESEND_EVENTS_SEQUENCE_RUN_REPOSITORY)
    private readonly runRepo: ResendEventsSequenceRunRepository,
    @Inject(RESEND_EVENTS_BUSINESS_REPOSITORY)
    private readonly businessRepo: ResendEventsBusinessRepository,
    @Inject(EMAIL_SERVICE)
    private readonly emailService: EmailService,
  ) {}

  async execute(input: HandleEmailComplainedInput): Promise<void> {
    const message = await this.messageRepo.findByExternalId(input.externalMessageId);

    if (!message) {
      this.logger.warn({
        msg: "No message found for Resend external ID — skipping complained event",
        externalMessageId: input.externalMessageId,
      });
      return;
    }

    await this.messageRepo.updateStatus(message.id, message.businessId, "failed");

    if (message.sequenceRunId) {
      await this.runRepo.pauseRun(message.sequenceRunId, message.businessId, PAUSED_REASONS.SPAM_COMPLAINT);
    }

    const business = await this.businessRepo.findWithOwner(message.businessId);

    if (business) {
      try {
        await this.emailService.send({
          from: ALERTS_FROM,
          to: business.ownerEmail,
          subject: `Action needed: ${business.name} marked your email as spam`,
          html: `<p>A contact at <strong>${business.name}</strong> marked your follow-up email as spam. Their sequence has been paused automatically. You may want to reach out to them through a different channel.</p>`,
        });
      } catch (err) {
        this.logger.error({
          msg: "Failed to send spam alert email — continuing",
          event: "spam_alert_failed",
          error: err instanceof Error ? err.message : String(err),
          businessId: message.businessId,
        });
      }
    }

    this.logger.log({
      msg: "Email spam complaint handled",
      messageId: message.id,
      externalMessageId: input.externalMessageId,
      sequenceRunId: message.sequenceRunId,
    });
  }
}
