import { Inject, Injectable, Logger } from "@nestjs/common";
import { STOPPED_REASONS } from "@nudge/shared";
import {
  type TwilioEventsCustomerRepository,
  type TwilioEventsSequenceRunRepository,
  type TwilioEventsBusinessRepository,
  TWILIO_EVENTS_CUSTOMER_REPOSITORY,
  TWILIO_EVENTS_SEQUENCE_RUN_REPOSITORY,
  TWILIO_EVENTS_BUSINESS_REPOSITORY,
} from "../domain/twilio-events.repositories";
import {
  type EmailService,
  EMAIL_SERVICE,
} from "../../message-send/domain/email.service";

const ALERTS_FROM = "Nudge <alerts@paynudge.net>";

export interface HandleSmsReceivedInput {
  fromPhone: string;
  replyBody: string;
}

export function toDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

@Injectable()
export class HandleSmsReceivedUseCase {
  private readonly logger = new Logger(HandleSmsReceivedUseCase.name);

  constructor(
    @Inject(TWILIO_EVENTS_CUSTOMER_REPOSITORY)
    private readonly customerRepo: TwilioEventsCustomerRepository,
    @Inject(TWILIO_EVENTS_SEQUENCE_RUN_REPOSITORY)
    private readonly runRepo: TwilioEventsSequenceRunRepository,
    @Inject(TWILIO_EVENTS_BUSINESS_REPOSITORY)
    private readonly businessRepo: TwilioEventsBusinessRepository,
    @Inject(EMAIL_SERVICE)
    private readonly emailService: EmailService,
  ) {}

  async execute(input: HandleSmsReceivedInput): Promise<void> {
    const digits = toDigits(input.fromPhone);

    if (!digits) {
      this.logger.warn({
        msg: "Inbound SMS missing usable phone digits — skipping",
        event: "sms_received_no_phone",
      });
      return;
    }

    const runs = await this.customerRepo.findActiveRunsByContactPhone(digits);

    if (runs.length === 0) {
      this.logger.warn({
        msg: "No active runs found for inbound SMS sender — skipping",
        event: "sms_received_no_match",
        fromPhoneDigits: digits,
      });
      return;
    }

    for (const run of runs) {
      await this.runRepo.stopRun(
        run.runId,
        run.businessId,
        STOPPED_REASONS.CLIENT_REPLIED,
      );

      const business = await this.businessRepo.findWithOwner(run.businessId);

      if (business) {
        try {
          await this.emailService.send({
            from: ALERTS_FROM,
            to: business.ownerEmail,
            subject: `${run.companyName} replied to your follow-up`,
            html: `<p><strong>${escapeHtml(run.companyName)}</strong> replied via SMS from <strong>${escapeHtml(input.fromPhone)}</strong>. Their sequence has been stopped.</p><p>Reply: <em>${escapeHtml(input.replyBody)}</em></p><p>Log in to Nudge to view the reply and take next steps.</p>`,
          });
        } catch (err) {
          this.logger.error({
            msg: "Failed to send SMS reply alert email — continuing",
            event: "sms_reply_alert_failed",
            error: err instanceof Error ? err.message : String(err),
            businessId: run.businessId,
          });
        }
      }
    }

    this.logger.log({
      msg: "Sequence runs stopped due to customer SMS reply",
      event: "client_replied_sms",
      fromPhoneDigits: digits,
      stoppedCount: runs.length,
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
