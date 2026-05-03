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
  type EmailService,
  EMAIL_SERVICE,
} from "../../message-send/domain/email.service";

const ALERTS_FROM = "Nudge <alerts@paynudge.net>";

export interface HandleEmailReceivedInput {
  fromEmail: string;
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

    for (const run of runs) {
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
