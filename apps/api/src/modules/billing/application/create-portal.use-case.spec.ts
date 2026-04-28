import { CreatePortalUseCase } from "./create-portal.use-case";
import { BillingAccount } from "../domain/billing.entity";
import {
  AccountNotFoundError,
  NoStripeCustomerError,
} from "../domain/billing.errors";

function makeAccount(
  overrides: {
    stripeCustomerId?: string | null;
  } = {},
): BillingAccount {
  return new BillingAccount(
    "acc-1",
    "starter",
    "active",
    overrides.stripeCustomerId !== undefined
      ? overrides.stripeCustomerId
      : "cus_abc123",
    "sub_xyz",
    null,
  );
}

describe("CreatePortalUseCase", () => {
  let billingRepo: {
    findByAccountId: jest.Mock;
    updateStripeCustomerId: jest.Mock;
  };
  let stripeService: {
    createCheckoutSession: jest.Mock;
    createPortalSession: jest.Mock;
    getSubscriptionInfo: jest.Mock;
  };
  let useCase: CreatePortalUseCase;

  beforeEach(() => {
    billingRepo = {
      findByAccountId: jest.fn(),
      updateStripeCustomerId: jest.fn(),
    };
    stripeService = {
      createCheckoutSession: jest.fn(),
      createPortalSession: jest.fn().mockResolvedValue({
        portalUrl: "https://billing.stripe.com/p/session_test",
      }),
      getSubscriptionInfo: jest.fn(),
    };
    useCase = new CreatePortalUseCase(
      billingRepo as never,
      stripeService as never,
    );
  });

  it("returns portal_url for an account with a stripe customer", async () => {
    billingRepo.findByAccountId.mockResolvedValue(
      makeAccount({ stripeCustomerId: "cus_abc123" }),
    );

    const result = await useCase.execute("acc-1");

    expect(result.portalUrl).toBe("https://billing.stripe.com/p/session_test");
    expect(stripeService.createPortalSession).toHaveBeenCalledWith({
      stripeCustomerId: "cus_abc123",
    });
  });

  it("throws AccountNotFoundError when account does not exist", async () => {
    billingRepo.findByAccountId.mockResolvedValue(null);

    await expect(useCase.execute("acc-missing")).rejects.toThrow(
      AccountNotFoundError,
    );
    expect(stripeService.createPortalSession).not.toHaveBeenCalled();
  });

  it("throws NoStripeCustomerError when account has not subscribed yet", async () => {
    billingRepo.findByAccountId.mockResolvedValue(
      makeAccount({ stripeCustomerId: null }),
    );

    await expect(useCase.execute("acc-1")).rejects.toThrow(
      NoStripeCustomerError,
    );
    expect(stripeService.createPortalSession).not.toHaveBeenCalled();
  });
});
