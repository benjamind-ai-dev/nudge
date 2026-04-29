import { Inject, Injectable } from "@nestjs/common";
import {
  BillingRepository,
  BILLING_REPOSITORY,
} from "../domain/billing.repository";
import { StripeService, STRIPE_SERVICE } from "../domain/stripe.service";
import { AccountNotFoundError } from "../domain/billing.errors";
import { BillingPlan, BillingStatus } from "../domain/billing.entity";

export interface BillingStatusResult {
  plan: BillingPlan | null;
  status: BillingStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: Date | null;
  hasStripeCustomer: boolean;
}

@Injectable()
export class GetBillingStatusUseCase {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepo: BillingRepository,
    @Inject(STRIPE_SERVICE)
    private readonly stripe: StripeService,
  ) {}

  async execute(accountId: string): Promise<BillingStatusResult> {
    const account = await this.billingRepo.findByAccountId(accountId);
    if (!account) {
      throw new AccountNotFoundError(accountId);
    }

    if (!account.hasStripeCustomer()) {
      return {
        plan: null,
        status: "trial",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        trialEndsAt: account.trialEndsAt,
        hasStripeCustomer: false,
      };
    }

    const stripeInfo = await this.stripe.getSubscriptionInfo(
      account.stripeCustomerId!,
    );

    if (!stripeInfo) {
      return {
        plan: null,
        status: "trial",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        trialEndsAt: account.trialEndsAt,
        hasStripeCustomer: true,
      };
    }

    const stripeStatus = stripeInfo.status === "trialing" ? "trial" : stripeInfo.status;

    return {
      plan: stripeInfo.plan,
      status: stripeStatus as BillingStatus,
      currentPeriodEnd: stripeInfo.currentPeriodEnd,
      cancelAtPeriodEnd: stripeInfo.cancelAtPeriodEnd,
      trialEndsAt: stripeInfo.trialEnd,
      hasStripeCustomer: true,
    };
  }
}
