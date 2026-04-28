import { Inject, Injectable } from "@nestjs/common";
import {
  BillingRepository,
  BILLING_REPOSITORY,
} from "../domain/billing.repository";
import { StripeService, STRIPE_SERVICE } from "../domain/stripe.service";
import { AccountNotFoundError } from "../domain/billing.errors";
import { BillingPlan } from "../domain/billing.entity";

export interface CreateCheckoutResult {
  checkoutUrl: string;
}

@Injectable()
export class CreateCheckoutUseCase {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepo: BillingRepository,
    @Inject(STRIPE_SERVICE)
    private readonly stripe: StripeService,
  ) {}

  async execute(
    accountId: string,
    plan: BillingPlan,
  ): Promise<CreateCheckoutResult> {
    const account = await this.billingRepo.findByAccountId(accountId);
    if (!account) {
      throw new AccountNotFoundError(accountId);
    }

    const result = await this.stripe.createCheckoutSession({
      accountId,
      plan,
      stripeCustomerId: account.stripeCustomerId,
      isNewCustomer: !account.hasStripeCustomer(),
    });

    if (!account.hasStripeCustomer()) {
      await this.billingRepo.updateStripeCustomerId(
        accountId,
        result.stripeCustomerId,
      );
    }

    return { checkoutUrl: result.checkoutUrl };
  }
}
