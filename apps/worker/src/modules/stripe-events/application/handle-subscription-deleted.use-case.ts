import { Inject, Injectable, Logger } from "@nestjs/common";
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
  StripeSubscription,
  StripeEventEnvelope,
} from "../domain/stripe-event-payloads";
import type { Env } from "../../../common/config/env.schema";

@Injectable()
export class HandleSubscriptionDeletedUseCase {
  private readonly logger = new Logger(HandleSubscriptionDeletedUseCase.name);
  private readonly notificationsEmail: string;
  private readonly billingUrl: string;

  constructor(
    @Inject(ACCOUNT_BILLING_REPOSITORY)
    private readonly accounts: AccountBillingRepository,
    @Inject(EMAIL_SERVICE)
    private readonly email: EmailService,
    config: ConfigService<Env, true>,
  ) {
    this.notificationsEmail = config.get("NOTIFICATIONS_EMAIL", {
      infer: true,
    });
    this.billingUrl = `${config.get("FRONTEND_URL", { infer: true })}/settings/billing`;
  }

  async execute(payload: unknown): Promise<void> {
    const event = payload as StripeEventEnvelope<StripeSubscription>;
    const subscription = event.data.object;

    const customerId = subscription.customer;
    const account = await this.accounts.findByStripeCustomerId(customerId);
    if (!account) {
      throw new AccountNotFoundError(`stripe_customer:${customerId}`);
    }

    await this.accounts.updateBillingState(account.id, {
      status: "canceled",
    });

    const stoppedCount = await this.accounts.stopAllActiveSequenceRuns(
      account.id,
    );

    this.logger.log({
      msg: "Account cancelled via customer.subscription.deleted",
      event: "stripe_subscription_deleted",
      accountId: account.id,
      stripeCustomerId: customerId,
      subscriptionId: subscription.id,
      stoppedSequenceRuns: stoppedCount,
    });

    await this.sendCancellationEmail(account.email);
  }

  private async sendCancellationEmail(ownerEmail: string): Promise<void> {
    try {
      await this.email.send({
        from: this.notificationsEmail,
        to: ownerEmail,
        subject: "Your Nudge subscription has been cancelled",
        html: `
          <p>Hi,</p>
          <p>Your Nudge subscription has been cancelled.</p>
          <p>Your sequences have been paused.</p>
          <p>
            If you'd like to reactivate, you can subscribe again at any time:
            <a href="${this.billingUrl}">Reactivate subscription</a>
          </p>
          <p>The Nudge team</p>
        `,
      });
    } catch (err) {
      this.logger.error({
        msg: "Failed to send cancellation email",
        event: "stripe_cancellation_email_error",
        ownerEmail,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
