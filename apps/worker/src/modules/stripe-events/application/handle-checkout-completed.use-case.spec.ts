import { HandleCheckoutCompletedUseCase } from "./handle-checkout-completed.use-case";
import type { AccountBillingRepository } from "../domain/account-billing.repository";

const ACCOUNT_UUID = "a61b4065-d64a-430c-a92b-e914930385d4";

const makeRepo = (over: Partial<AccountBillingRepository> = {}): AccountBillingRepository =>
  ({
    findByStripeCustomerId: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn().mockResolvedValue({
      id: ACCOUNT_UUID,
      plan: null,
      maxBusinesses: 1,
    }),
    findByClerkId: jest.fn(),
    updateBillingState: jest.fn().mockResolvedValue(undefined),
    stopAllActiveSequenceRuns: jest.fn(),
    ...over,
  }) as unknown as AccountBillingRepository;

const event = (metadata: Record<string, string>) => ({
  data: {
    object: {
      id: "cs_test_1",
      customer: "cus_123",
      subscription: "sub_123",
      customer_email: "owner@example.com",
      metadata,
    },
  },
});

describe("HandleCheckoutCompletedUseCase", () => {
  it("looks up the account by id (metadata.account_id is the UUID) and activates it", async () => {
    const repo = makeRepo();
    const useCase = new HandleCheckoutCompletedUseCase(repo);

    await useCase.execute(event({ account_id: ACCOUNT_UUID, plan: "growth" }));

    expect(repo.findById).toHaveBeenCalledWith(ACCOUNT_UUID);
    expect(repo.findByClerkId).not.toHaveBeenCalled();
    expect(repo.updateBillingState).toHaveBeenCalledWith(
      ACCOUNT_UUID,
      expect.objectContaining({
        status: "active",
        plan: "growth",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
      }),
    );
  });

  it("falls back to email lookup when metadata has no account_id", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn().mockResolvedValue({
        id: ACCOUNT_UUID,
        plan: null,
        maxBusinesses: 1,
      }),
    });
    const useCase = new HandleCheckoutCompletedUseCase(repo);

    await useCase.execute(event({ plan: "starter" }));

    expect(repo.findByEmail).toHaveBeenCalledWith("owner@example.com");
    expect(repo.updateBillingState).toHaveBeenCalledWith(
      ACCOUNT_UUID,
      expect.objectContaining({ status: "active", plan: "starter" }),
    );
  });
});
