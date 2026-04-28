import { BillingAccount, BillingPlan, BillingStatus } from "./billing.entity";

function makeBillingAccount(
  overrides: {
    id?: string;
    plan?: BillingPlan | null;
    status?: BillingStatus;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    trialEndsAt?: Date | null;
  } = {},
): BillingAccount {
  return new BillingAccount(
    overrides.id !== undefined ? overrides.id : "acc-1",
    overrides.plan !== undefined ? overrides.plan : "starter",
    overrides.status !== undefined ? overrides.status : "active",
    overrides.stripeCustomerId !== undefined
      ? overrides.stripeCustomerId
      : "cus_abc123",
    overrides.stripeSubscriptionId !== undefined
      ? overrides.stripeSubscriptionId
      : "sub_xyz",
    overrides.trialEndsAt !== undefined ? overrides.trialEndsAt : null,
  );
}

describe("BillingAccount", () => {
  describe("hasStripeCustomer()", () => {
    it("returns true when stripeCustomerId is set", () => {
      const account = makeBillingAccount({ stripeCustomerId: "cus_abc123" });
      expect(account.hasStripeCustomer()).toBe(true);
    });

    it("returns false when stripeCustomerId is null", () => {
      const account = makeBillingAccount({ stripeCustomerId: null });
      expect(account.hasStripeCustomer()).toBe(false);
    });
  });

  describe("isOnTrial()", () => {
    it("returns true when status is trial", () => {
      const account = makeBillingAccount({ status: "trial" });
      expect(account.isOnTrial()).toBe(true);
    });

    it("returns false when status is active", () => {
      const account = makeBillingAccount({ status: "active" });
      expect(account.isOnTrial()).toBe(false);
    });

    it("returns false when status is canceled", () => {
      const account = makeBillingAccount({ status: "canceled" });
      expect(account.isOnTrial()).toBe(false);
    });

    it("returns false when status is past_due", () => {
      const account = makeBillingAccount({ status: "past_due" });
      expect(account.isOnTrial()).toBe(false);
    });
  });
});
