import { Inject, Injectable, Logger } from "@nestjs/common";
import { STOPPED_REASONS, formatCents } from "@nudge/shared";
import {
  type ResendEventsCustomerRepository,
  RESEND_EVENTS_CUSTOMER_REPOSITORY,
  type ActiveRunForCustomer,
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
            html: this.renderReplyAlertHtml(run, input.fromEmail),
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

  private renderReplyAlertHtml(run: ActiveRunForCustomer, fromEmail: string): string {
    const balance = formatCents(run.balanceDueCents);
    const invoiceLine = run.invoiceNumber
      ? `Invoice ${escapeHtml(run.invoiceNumber)} — <strong>${balance}</strong> due`
      : `<strong>${balance}</strong> due`;

    const ctaButton = run.paymentLinkUrl
      ? `<p style="margin:24px 0;">
           <a href="${buildMailtoForward(fromEmail, run.invoiceNumber, run.paymentLinkUrl)}"
              style="background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;font-weight:600;">
             Send Payment Link →
           </a>
         </p>`
      : "";

    return `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#111;">
        <p><strong>${escapeHtml(run.companyName)}</strong> replied to your follow-up email from <strong>${escapeHtml(fromEmail)}</strong>. Their sequence has been stopped.</p>
        <p>${invoiceLine}</p>
        ${ctaButton}
      </div>
    `.trim();
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildMailtoForward(
  toEmail: string,
  invoiceNumber: string | null,
  paymentLinkUrl: string,
): string {
  const subject = invoiceNumber
    ? `Payment link for invoice ${invoiceNumber}`
    : `Payment link for your invoice`;
  const body = `Hi,\n\nHere is the payment link for your invoice:\n${paymentLinkUrl}\n\nThanks!`;
  const params = new URLSearchParams({ subject, body });
  return `mailto:${toEmail}?${params.toString()}`;
}
