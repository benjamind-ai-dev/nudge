import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { QUEUE_NAMES, type StripeEventsJobData } from "@nudge/shared";
import { ConfigService } from "@nestjs/config";
import {
  ACCOUNT_BILLING_REPOSITORY,
  type AccountBillingRepository,
} from "../domain/account-billing.repository";
import {
  EMAIL_SERVICE,
  type EmailService,
} from "../../message-send/domain/email.service";
import { AccountNotFoundError } from "../domain/stripe-events.errors";
import type {
  StripeInvoice,
  StripeEventEnvelope,
} from "../domain/stripe-event-payloads";
import type { Env } from "../../../common/config/env.schema";

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const GRACE_PERIOD_JOB_NAME = "grace-period-check";
export const GRACE_PERIOD_EVENT_TYPE = "nudge.grace_period_check";

@Injectable()
export class HandlePaymentFailedUseCase {
  private readonly logger = new Logger(HandlePaymentFailedUseCase.name);
  private readonly notificationsEmail: string;
  private readonly billingUrl: string;

  constructor(
    @Inject(ACCOUNT_BILLING_REPOSITORY)
    private readonly accounts: AccountBillingRepository,
    @Inject(EMAIL_SERVICE)
    private readonly email: EmailService,
    @InjectQueue(QUEUE_NAMES.STRIPE_EVENTS)
    private readonly queue: Queue<StripeEventsJobData>,
    config: ConfigService<Env, true>,
  ) {
    this.notificationsEmail = config.get("NOTIFICATIONS_EMAIL", {
      infer: true,
    });
    this.billingUrl = `${config.get("FRONTEND_URL", { infer: true })}/settings/billing`;
  }

  async execute(payload: unknown): Promise<void> {
    const event = payload as StripeEventEnvelope<StripeInvoice>;
    const invoice = event.data.object;

    const customerId = invoice.customer;
    if (!customerId) {
      this.logger.warn({
        msg: "invoice.payment_failed missing customer ID",
        event: "stripe_payment_failed_no_customer",
        invoiceId: invoice.id,
      });
      return;
    }

    const account = await this.accounts.findByStripeCustomerId(customerId);
    if (!account) {
      throw new AccountNotFoundError(`stripe_customer:${customerId}`);
    }

    await this.accounts.updateBillingState(account.id, { status: "past_due" });

    this.logger.log({
      msg: "Account status set to past_due via invoice.payment_failed",
      event: "stripe_payment_failed",
      accountId: account.id,
      stripeCustomerId: customerId,
      invoiceId: invoice.id,
    });

    await this.sendPaymentFailedAlert(account.email);
    await this.scheduleGracePeriodCheck(account.id);
  }

  private async sendPaymentFailedAlert(ownerEmail: string): Promise<void> {
    try {
      await this.email.send({
        from: this.notificationsEmail,
        to: ownerEmail,
        subject: "Action required: Your Nudge payment failed",
        html: `
          <p>Hi,</p>
          <p>We were unable to process your payment for Nudge.</p>
          <p>Please update your payment method to keep your sequences running.</p>
          <p>
            <a href="${this.billingUrl}">
              Update payment method
            </a>
          </p>
          <p>If your payment isn't updated within 7 days, your active sequences will be paused.</p>
          <p>The Nudge team</p>
        `,
      });
    } catch (err) {
      this.logger.error({
        msg: "Failed to send payment failed alert email",
        event: "stripe_payment_failed_email_error",
        ownerEmail,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async scheduleGracePeriodCheck(accountId: string): Promise<void> {
    const stableJobId = `grace-period-${accountId}`;
    const gracePeriodData: StripeEventsJobData = {
      eventId: stableJobId,
      eventType: GRACE_PERIOD_EVENT_TYPE,
      payload: { accountId },
    };

    await this.queue.add(GRACE_PERIOD_JOB_NAME, gracePeriodData, {
      jobId: stableJobId,
      delay: GRACE_PERIOD_MS,
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: 50,
      removeOnFail: 100,
    });

    this.logger.log({
      msg: "Grace period check scheduled for 7 days",
      event: "stripe_grace_period_scheduled",
      accountId,
    });
  }
}
