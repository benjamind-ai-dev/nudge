import { Inject, Injectable, Logger } from "@nestjs/common";
import { STOPPED_REASONS } from "@nudge/shared";
import {
  type ResendEventsCustomerRepository,
  RESEND_EVENTS_CUSTOMER_REPOSITORY,
} from "../domain/resend-events-customer.repository";
import {
  type ResendEventsSequenceRunRepository,
  RESEND_EVENTS_SEQUENCE_RUN_REPOSITORY,
} from "../domain/resend-events-sequence-run.repository";
import {
  type ResendEventsBusinessRepository,
  RESEND_EVENTS_BUSINESS_REPOSITORY,
} from "../domain/resend-events-business.repository";
import {
  type ResendEventsMessageRepository,
  RESEND_EVENTS_MESSAGE_REPOSITORY,
} from "../domain/resend-events-message.repository";
import {
  type AiDraftProducer,
  AI_DRAFT_PRODUCER,
} from "../domain/ai-draft.producer";
import {
  type EmailService,
  EMAIL_SERVICE,
} from "../../message-send/domain/email.service";

const ALERTS_FROM = "Nudge <alerts@paynudge.net>";

export interface HandleEmailReceivedInput {
  fromEmail: string;
  replyBody: string;
}

@Injectable()
export class HandleEmailReceivedUseCase {
  private readonly logger = new Logger(HandleEmailReceivedUseCase.name);

  constructor(
    @Inject(RESEND_EVENTS_CUSTOMER_REPOSITORY)
    private readonly customerRepo: ResendEventsCustomerRepository,
    @Inject(RESEND_EVENTS_SEQUENCE_RUN_REPOSITORY)
    private readonly runRepo: ResendEventsSequenceRunRepository,
    @Inject(RESEND_EVENTS_BUSINESS_REPOSITORY)
    private readonly businessRepo: ResendEventsBusinessRepository,
    @Inject(RESEND_EVENTS_MESSAGE_REPOSITORY)
    private readonly messageRepo: ResendEventsMessageRepository,
    @Inject(AI_DRAFT_PRODUCER)
    private readonly aiDraftProducer: AiDraftProducer,
    @Inject(EMAIL_SERVICE)
    private readonly emailService: EmailService,
  ) {}

  async execute(input: HandleEmailReceivedInput): Promise<void> {
    const runs = await this.customerRepo.findActiveRunsByContactEmail(input.fromEmail);

    if (runs.length === 0) {
      this.logger.warn({
        msg: "No active runs found for reply sender — skipping",
        fromEmail: input.fromEmail,
      });
      return;
    }

    const repliedAt = new Date();

    for (const run of runs) {
      // Identify the outbound email the client is replying to and persist the
      // reply body + repliedAt on it, then enqueue an AI draft for that message.
      // Done before stopRun so the message-aware work happens against an
      // unambiguous run state. If no sent email exists on the run, we still
      // stop the run and alert the owner — just without a draft.
      const sentMessage = await this.messageRepo.findLatestSentEmailForRun(run.runId);

      if (sentMessage) {
        await this.messageRepo.markReplied(
          sentMessage.id,
          sentMessage.businessId,
          input.replyBody,
          repliedAt,
        );

        try {
          await this.aiDraftProducer.enqueue(sentMessage.id, sentMessage.businessId);
        } catch (err) {
          this.logger.error({
            msg: "Failed to enqueue ai-draft job — continuing",
            event: "ai_draft_enqueue_failed",
            error: err instanceof Error ? err.message : String(err),
            messageId: sentMessage.id,
            businessId: sentMessage.businessId,
          });
        }
      } else {
        this.logger.warn({
          msg: "Reply received for run with no sent email — skipping draft",
          event: "reply_no_sent_email",
          runId: run.runId,
          businessId: run.businessId,
        });
      }

      await this.runRepo.stopRun(run.runId, run.businessId, STOPPED_REASONS.CLIENT_REPLIED);

      const business = await this.businessRepo.findWithOwner(run.businessId);

      if (business) {
        try {
          await this.emailService.send({
            from: ALERTS_FROM,
            to: business.ownerEmail,
            subject: `${run.companyName} replied to your follow-up`,
            html: `<p><strong>${run.companyName}</strong> replied to your follow-up email from <strong>${input.fromEmail}</strong>. Their sequence has been stopped.</p><p>Log in to Nudge to view the reply and take next steps.</p>`,
          });
        } catch (err) {
          this.logger.error({
            msg: "Failed to send reply alert email — continuing",
            event: "reply_alert_failed",
            error: err instanceof Error ? err.message : String(err),
            businessId: run.businessId,
          });
        }
      }
    }

    this.logger.log({
      msg: "Sequence runs stopped due to customer reply",
      event: "client_replied",
      fromEmail: input.fromEmail,
      stoppedCount: runs.length,
    });
  }
}
