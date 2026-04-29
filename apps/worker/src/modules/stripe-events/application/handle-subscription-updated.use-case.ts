import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ACCOUNT_BILLING_REPOSITORY,
  type AccountBillingRepository,
} from "../domain/account-billing.repository";
import {
  PLAN_CONFIG_SERVICE,
  type PlanConfigService,
} from "../domain/plan-config";
import {
  AccountNotFoundError,
  UnknownPriceIdError,
} from "../domain/stripe-events.errors";
import type {
  StripeSubscription,
  StripeEventEnvelope,
} from "../domain/stripe-event-payloads";

@Injectable()
export class HandleSubscriptionUpdatedUseCase {
  private readonly logger = new Logger(HandleSubscriptionUpdatedUseCase.name);

  constructor(
    @Inject(ACCOUNT_BILLING_REPOSITORY)
    private readonly accounts: AccountBillingRepository,
    @Inject(PLAN_CONFIG_SERVICE)
    private readonly planConfig: PlanConfigService,
  ) {}

  async execute(payload: unknown): Promise<void> {
    const event = payload as StripeEventEnvelope<StripeSubscription>;
    const subscription = event.data.object;

    const customerId = subscription.customer;
    const account = await this.accounts.findByStripeCustomerId(customerId);
    if (!account) {
      throw new AccountNotFoundError(`stripe_customer:${customerId}`);
    }

    const priceId = subscription.items.data[0]?.price?.id;
    if (!priceId) {
      this.logger.warn({
        msg: "customer.subscription.updated has no price ID",
        event: "stripe_subscription_updated_no_price",
        subscriptionId: subscription.id,
        accountId: account.id,
      });
      return;
    }

    const planMeta = this.planConfig.resolveByPriceId(priceId);
    if (!planMeta) {
      throw new UnknownPriceIdError(priceId);
    }

    const isDowngrade = planMeta.maxBusinesses < account.maxBusinesses;

    await this.accounts.updateBillingState(account.id, {
      plan: planMeta.plan,
      maxBusinesses: planMeta.maxBusinesses,
    });

    this.logger.log({
      msg: "Account plan updated via customer.subscription.updated",
      event: "stripe_subscription_updated",
      accountId: account.id,
      oldPlan: account.plan,
      newPlan: planMeta.plan,
      oldMaxBusinesses: account.maxBusinesses,
      newMaxBusinesses: planMeta.maxBusinesses,
      isDowngrade,
      subscriptionId: subscription.id,
    });

    if (isDowngrade) {
      this.logger.log({
        msg: "Plan downgrade detected — existing businesses unaffected, new additions blocked",
        event: "stripe_subscription_downgrade",
        accountId: account.id,
        currentBusinessCount: account.businessCount,
        newMaxBusinesses: planMeta.maxBusinesses,
      });
    }
  }
}
