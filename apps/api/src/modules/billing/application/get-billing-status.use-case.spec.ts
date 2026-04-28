import { GetBillingStatusUseCase } from "./get-billing-status.use-case";
import { BillingAccount } from "../domain/billing.entity";
import { AccountNotFoundError } from "../domain/billing.errors";
import { StripeSubscriptionInfo } from "../domain/stripe.service";

const TRIAL_ENDS = new Date("2026-05-12");
const PERIOD_END = new Date("2026-06-01");

function makeAccount(
  overrides: {
    stripeCustomerId?: string | null;
    trialEndsAt?: Date | null;
  } = {},
): BillingAccount {
  return new BillingAccount(
    "acc-1",
    null,
    "trial",
    overrides.stripeCustomerId !== undefined
      ? overrides.stripeCustomerId
      : null,
    null,
    overrides.trialEndsAt !== undefined ? overrides.trialEndsAt : TRIAL_ENDS,
  );
}

function makeStripeInfo(
  overrides: Partial<StripeSubscriptionInfo> = {},
): StripeSubscriptionInfo {
  return {
    plan: "starter",
    status: "active",
    currentPeriodEnd: PERIOD_END,
    cancelAtPeriodEnd: false,
    trialEnd: null,
    ...overrides,
  };
}

describe("GetBillingStatusUseCase", () => {
  let billingRepo: {
    findByAccountId: jest.Mock;
    updateStripeCustomerId: jest.Mock;
  };
  let stripeService: {
    createCheckoutSession: jest.Mock;
    createPortalSession: jest.Mock;
    getSubscriptionInfo: jest.Mock;
  };
  let useCase: GetBillingStatusUseCase;

  beforeEach(() => {
    billingRepo = {
      findByAccountId: jest.fn(),
      updateStripeCustomerId: jest.fn(),
    };
    stripeService = {
      createCheckoutSession: jest.fn(),
      createPortalSession: jest.fn(),
      getSubscriptionInfo: jest.fn(),
    };
    useCase = new GetBillingStatusUseCase(
      billingRepo as never,
      stripeService as never,
    );
  });

  describe("account with no stripe customer (trial)", () => {
    it("returns trial status with trialEndsAt from the account", async () => {
      billingRepo.findByAccountId.mockResolvedValue(
        makeAccount({ trialEndsAt: TRIAL_ENDS }),
      );

      const result = await useCase.execute("acc-1");

      expect(result).toEqual({
        plan: null,
        status: "trial",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        trialEndsAt: TRIAL_ENDS,
      });
      expect(stripeService.getSubscriptionInfo).not.toHaveBeenCalled();
    });
  });

  describe("account with stripe customer but no active subscription", () => {
    it("returns trial status when stripe has no subscription", async () => {
      billingRepo.findByAccountId.mockResolvedValue(
        makeAccount({ stripeCustomerId: "cus_abc", trialEndsAt: TRIAL_ENDS }),
      );
      stripeService.getSubscriptionInfo.mockResolvedValue(null);

      const result = await useCase.execute("acc-1");

      expect(result).toEqual({
        plan: null,
        status: "trial",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        trialEndsAt: TRIAL_ENDS,
      });
    });
  });

  describe("account with active subscription", () => {
    beforeEach(() => {
      billingRepo.findByAccountId.mockResolvedValue(
        makeAccount({ stripeCustomerId: "cus_abc" }),
      );
    });

    it("returns active subscription info with all fields", async () => {
      stripeService.getSubscriptionInfo.mockResolvedValue(makeStripeInfo());

      const result = await useCase.execute("acc-1");

      expect(result).toEqual({
        plan: "starter",
        status: "active",
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: false,
        trialEndsAt: null,
      });
      expect(stripeService.getSubscriptionInfo).toHaveBeenCalledWith("cus_abc");
    });

    it("reflects cancel_at_period_end when user is cancelling", async () => {
      stripeService.getSubscriptionInfo.mockResolvedValue(
        makeStripeInfo({ cancelAtPeriodEnd: true }),
      );

      const result = await useCase.execute("acc-1");

      expect(result.cancelAtPeriodEnd).toBe(true);
    });

    it("includes trialEnd when subscription is still in trial", async () => {
      const trialEnd = new Date("2026-05-15");
      stripeService.getSubscriptionInfo.mockResolvedValue(
        makeStripeInfo({ status: "trialing", trialEnd }),
      );

      const result = await useCase.execute("acc-1");

      expect(result.status).toBe("trialing");
      expect(result.trialEndsAt).toEqual(trialEnd);
    });

    it("returns past_due status when payment has failed", async () => {
      stripeService.getSubscriptionInfo.mockResolvedValue(
        makeStripeInfo({ status: "past_due", plan: "growth" }),
      );

      const result = await useCase.execute("acc-1");

      expect(result.status).toBe("past_due");
      expect(result.plan).toBe("growth");
    });
  });

  describe("error cases", () => {
    it("throws AccountNotFoundError when account does not exist", async () => {
      billingRepo.findByAccountId.mockResolvedValue(null);

      await expect(useCase.execute("acc-missing")).rejects.toThrow(
        AccountNotFoundError,
      );
      expect(stripeService.getSubscriptionInfo).not.toHaveBeenCalled();
    });
  });
});
