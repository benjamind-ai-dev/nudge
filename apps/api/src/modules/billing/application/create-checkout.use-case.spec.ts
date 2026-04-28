import { CreateCheckoutUseCase } from "./create-checkout.use-case";
import { BillingAccount } from "../domain/billing.entity";
import { AccountNotFoundError } from "../domain/billing.errors";

function makeAccount(
  overrides: {
    stripeCustomerId?: string | null;
  } = {},
): BillingAccount {
  return new BillingAccount(
    "acc-1",
    "starter",
    "trial",
    overrides.stripeCustomerId !== undefined
      ? overrides.stripeCustomerId
      : null,
    null,
    new Date("2026-05-01"),
  );
}

describe("CreateCheckoutUseCase", () => {
  let billingRepo: {
    findByAccountId: jest.Mock;
    updateStripeCustomerId: jest.Mock;
  };
  let stripeService: {
    createCheckoutSession: jest.Mock;
    createPortalSession: jest.Mock;
    getSubscriptionInfo: jest.Mock;
  };
  let useCase: CreateCheckoutUseCase;

  beforeEach(() => {
    billingRepo = {
      findByAccountId: jest.fn(),
      updateStripeCustomerId: jest.fn().mockResolvedValue(undefined),
    };
    stripeService = {
      createCheckoutSession: jest.fn().mockResolvedValue({
        checkoutUrl: "https://checkout.stripe.com/pay/cs_test_abc",
        stripeCustomerId: "cus_new123",
      }),
      createPortalSession: jest.fn(),
      getSubscriptionInfo: jest.fn(),
    };
    useCase = new CreateCheckoutUseCase(
      billingRepo as never,
      stripeService as never,
    );
  });

  it("returns checkout_url for a new customer (no existing stripe id)", async () => {
    billingRepo.findByAccountId.mockResolvedValue(
      makeAccount({ stripeCustomerId: null }),
    );

    const result = await useCase.execute("acc-1", "starter");

    expect(result.checkoutUrl).toBe(
      "https://checkout.stripe.com/pay/cs_test_abc",
    );
    expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acc-1",
        plan: "starter",
        stripeCustomerId: null,
        isNewCustomer: true,
      }),
    );
  });

  it("saves the new stripeCustomerId after first checkout", async () => {
    billingRepo.findByAccountId.mockResolvedValue(
      makeAccount({ stripeCustomerId: null }),
    );

    await useCase.execute("acc-1", "growth");

    expect(billingRepo.updateStripeCustomerId).toHaveBeenCalledWith(
      "acc-1",
      "cus_new123",
    );
  });

  it("uses existing stripeCustomerId for upgrade flow and does not re-save", async () => {
    billingRepo.findByAccountId.mockResolvedValue(
      makeAccount({ stripeCustomerId: "cus_existing" }),
    );
    stripeService.createCheckoutSession.mockResolvedValue({
      checkoutUrl: "https://checkout.stripe.com/pay/cs_test_upgrade",
      stripeCustomerId: "cus_existing",
    });

    await useCase.execute("acc-1", "growth");

    expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeCustomerId: "cus_existing",
        isNewCustomer: false,
      }),
    );
    expect(billingRepo.updateStripeCustomerId).not.toHaveBeenCalled();
  });

  it("throws AccountNotFoundError when account does not exist", async () => {
    billingRepo.findByAccountId.mockResolvedValue(null);

    await expect(useCase.execute("acc-missing", "starter")).rejects.toThrow(
      AccountNotFoundError,
    );
    expect(stripeService.createCheckoutSession).not.toHaveBeenCalled();
  });
});
