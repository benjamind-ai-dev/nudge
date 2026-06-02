import { Inject, Injectable } from "@nestjs/common";
import { limitsForPlan, type PlanLimits } from "@nudge/shared";
import {
  BillingRepository,
  BILLING_REPOSITORY,
} from "../domain/billing.repository";
import { StripeService, STRIPE_SERVICE } from "../domain/stripe.service";
import { AccountNotFoundError } from "../domain/billing.errors";
import { BillingPlan, BillingStatus } from "../domain/billing.entity";
import { EntitlementsService } from "../../../common/entitlements/entitlements.service";

export interface BillingStatusResult {
  plan: BillingPlan | null;
  status: BillingStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: Date | null;
  hasStripeCustomer: boolean;
  limits: PlanLimits;
  usage: { seats: { used: number; max: number } };
}

@Injectable()
export class GetBillingStatusUseCase {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepo: BillingRepository,
    @Inject(STRIPE_SERVICE)
    private readonly stripe: StripeService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async execute(accountId: string): Promise<BillingStatusResult> {
    const account = await this.billingRepo.findByAccountId(accountId);
    if (!account) {
      throw new AccountNotFoundError(accountId);
    }

    const seatsUsed = await this.entitlements.seatUsage(accountId);
    const entitlementsFor = (plan: BillingPlan | null) => {
      const limits = limitsForPlan(plan);
      return {
        limits,
        usage: { seats: { used: seatsUsed, max: limits.maxSeats } },
      };
    };

    if (!account.hasStripeCustomer()) {
      return {
        plan: null,
        status: "trial",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        trialEndsAt: account.trialEndsAt,
        hasStripeCustomer: false,
        ...entitlementsFor(null),
      };
    }

    const stripeInfo = await this.stripe.getSubscriptionInfo(
      account.stripeCustomerId!,
      account.stripeSubscriptionId,
    );

    if (!stripeInfo) {
      return {
        plan: null,
        status: "trial",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        trialEndsAt: account.trialEndsAt,
        hasStripeCustomer: true,
        ...entitlementsFor(null),
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
      ...entitlementsFor(stripeInfo.plan),
    };
  }
}
