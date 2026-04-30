import { Inject, Injectable, Logger } from "@nestjs/common";
import { STOPPED_REASONS } from "@nudge/shared";
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

export interface HandleEmailBouncedInput {
  externalMessageId: string;
}

@Injectable()
export class HandleEmailBouncedUseCase {
  private readonly logger = new Logger(HandleEmailBouncedUseCase.name);

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

  async execute(input: HandleEmailBouncedInput): Promise<void> {
    const message = await this.messageRepo.findByExternalId(input.externalMessageId);

    if (!message) {
      this.logger.warn({
        msg: "No message found for Resend external ID — skipping bounced event",
        externalMessageId: input.externalMessageId,
      });
      return;
    }

    await this.messageRepo.updateStatus(message.id, message.businessId, "bounced");

    if (message.sequenceRunId) {
      await this.runRepo.stopRun(message.sequenceRunId, message.businessId, STOPPED_REASONS.EMAIL_BOUNCED);
    }

    const business = await this.businessRepo.findWithOwner(message.businessId);

    if (business) {
      try {
        await this.emailService.send({
          from: ALERTS_FROM,
          to: business.ownerEmail,
          subject: `Action needed: ${business.name}'s email is bouncing`,
          html: `<p>Emails to <strong>${business.name}</strong> are bouncing. Please update their contact email in your accounting system to resume automated follow-ups.</p>`,
        });
      } catch (err) {
        this.logger.error({
          msg: "Failed to send bounce alert email — continuing",
          event: "bounce_alert_failed",
          error: err instanceof Error ? err.message : String(err),
          businessId: message.businessId,
        });
      }
    }

    this.logger.log({
      msg: "Email bounce handled",
      messageId: message.id,
      externalMessageId: input.externalMessageId,
      sequenceRunId: message.sequenceRunId,
    });
  }
}
