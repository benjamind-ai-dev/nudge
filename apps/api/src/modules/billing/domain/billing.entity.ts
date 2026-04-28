export type BillingPlan = "starter" | "growth" | "agency";

export type BillingStatus =
  | "trial"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

export class BillingAccount {
  constructor(
    public readonly id: string,
    public readonly plan: BillingPlan | null,
    public readonly status: BillingStatus,
    public readonly stripeCustomerId: string | null,
    public readonly stripeSubscriptionId: string | null,
    public readonly trialEndsAt: Date | null,
  ) {}

  hasStripeCustomer(): boolean {
    return this.stripeCustomerId !== null;
  }

  isOnTrial(): boolean {
    return this.status === "trial";
  }
}
