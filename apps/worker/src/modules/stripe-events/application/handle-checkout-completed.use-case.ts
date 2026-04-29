import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ACCOUNT_BILLING_REPOSITORY,
  type AccountBillingRepository,
} from "../domain/account-billing.repository";
import { PLAN_META } from "../domain/plan-config";
import type { BillingPlan } from "../domain/account-billing.entity";
import { AccountNotFoundError } from "../domain/stripe-events.errors";
import type {
  StripeCheckoutSession,
  StripeEventEnvelope,
} from "../domain/stripe-event-payloads";

const KNOWN_PLANS = new Set<BillingPlan>(["starter", "growth", "agency"]);

@Injectable()
export class HandleCheckoutCompletedUseCase {
  private readonly logger = new Logger(HandleCheckoutCompletedUseCase.name);

  constructor(
    @Inject(ACCOUNT_BILLING_REPOSITORY)
    private readonly accounts: AccountBillingRepository,
  ) {}

  async execute(payload: unknown): Promise<void> {
    const event = payload as StripeEventEnvelope<StripeCheckoutSession>;
    const session = event.data.object;

    const accountIdFromMeta = session.metadata?.["account_id"];
    const planFromMeta = session.metadata?.["plan"];

    let account = accountIdFromMeta
      ? await this.accounts.findByClerkId(accountIdFromMeta)
      : null;

    if (!account && session.customer_email) {
      account = await this.accounts.findByEmail(session.customer_email);
    }

    if (!account) {
      this.logger.error({
        msg: "No account found for checkout.session.completed",
        event: "stripe_checkout_account_not_found",
        sessionId: session.id,
        customerEmail: session.customer_email,
        accountIdFromMeta,
      });
      throw new AccountNotFoundError(
        accountIdFromMeta ?? session.customer_email ?? "unknown",
      );
    }

    const plan =
      planFromMeta && KNOWN_PLANS.has(planFromMeta as BillingPlan)
        ? (planFromMeta as BillingPlan)
        : account.plan;

    const planMeta = plan ? PLAN_META[plan] : null;
    const maxBusinesses = planMeta?.maxBusinesses ?? account.maxBusinesses;

    await this.accounts.updateBillingState(account.id, {
      stripeCustomerId: session.customer ?? undefined,
      stripeSubscriptionId: session.subscription ?? undefined,
      status: "active",
      plan: plan ?? undefined,
      maxBusinesses,
    });

    this.logger.log({
      msg: "Account activated via checkout.session.completed",
      event: "stripe_checkout_completed",
      accountId: account.id,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      plan,
    });
  }
}
