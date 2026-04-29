export type BillingPlan = "starter" | "growth" | "agency";

export type BillingStatus =
  | "trial"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

export class AccountBilling {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly plan: BillingPlan | null,
    public readonly status: BillingStatus,
    public readonly stripeCustomerId: string | null,
    public readonly stripeSubscriptionId: string | null,
    public readonly maxBusinesses: number,
    public readonly businessCount: number,
  ) {}

  canAddBusiness(): boolean {
    return this.businessCount < this.maxBusinesses;
  }
}
