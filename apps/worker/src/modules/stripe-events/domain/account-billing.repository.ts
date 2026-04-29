import type {
  AccountBilling,
  BillingPlan,
  BillingStatus,
} from "./account-billing.entity";

export interface UpdateBillingStateParams {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  plan?: BillingPlan;
  status?: BillingStatus;
  maxBusinesses?: number;
}

export interface AccountBillingRepository {
  findByStripeCustomerId(customerId: string): Promise<AccountBilling | null>;
  findByEmail(email: string): Promise<AccountBilling | null>;
  findById(accountId: string): Promise<AccountBilling | null>;
  updateBillingState(
    accountId: string,
    params: UpdateBillingStateParams,
  ): Promise<void>;
  stopAllActiveSequenceRuns(accountId: string): Promise<number>;
}

export const ACCOUNT_BILLING_REPOSITORY = Symbol("AccountBillingRepository");
