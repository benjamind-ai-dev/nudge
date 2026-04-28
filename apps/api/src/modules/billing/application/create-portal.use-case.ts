import { Inject, Injectable } from "@nestjs/common";
import {
  BillingRepository,
  BILLING_REPOSITORY,
} from "../domain/billing.repository";
import { StripeService, STRIPE_SERVICE } from "../domain/stripe.service";
import {
  AccountNotFoundError,
  NoStripeCustomerError,
} from "../domain/billing.errors";

export interface CreatePortalResult {
  portalUrl: string;
}

@Injectable()
export class CreatePortalUseCase {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepo: BillingRepository,
    @Inject(STRIPE_SERVICE)
    private readonly stripe: StripeService,
  ) {}

  async execute(accountId: string): Promise<CreatePortalResult> {
    const account = await this.billingRepo.findByAccountId(accountId);
    if (!account) {
      throw new AccountNotFoundError(accountId);
    }

    if (!account.hasStripeCustomer()) {
      throw new NoStripeCustomerError(accountId);
    }

    const result = await this.stripe.createPortalSession({
      stripeCustomerId: account.stripeCustomerId!,
    });

    return { portalUrl: result.portalUrl };
  }
}
