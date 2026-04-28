import { BillingAccount } from "./billing.entity";

export interface BillingRepository {
  findByAccountId(accountId: string): Promise<BillingAccount | null>;
  updateStripeCustomerId(accountId: string, customerId: string): Promise<void>;
}

export const BILLING_REPOSITORY = Symbol("BillingRepository");
