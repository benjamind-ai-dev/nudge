import { UpdateCustomerUseCase } from "./update-customer.use-case";
import type { CustomerRepository } from "../domain/customer.repository";
import type { Customer } from "../domain/customer.entity";
import {
  CustomerNotFoundError,
  SequenceBelongsToDifferentBusinessError,
  TierBelongsToDifferentBusinessError,
} from "../domain/customer.errors";

const mkCustomer = (over: Partial<Customer> = {}): Customer => ({
  id: "cust-1",
  businessId: "biz-1",
  companyName: "Acme Corp",
  contactName: "John Doe",
  contactEmail: "john@acme.com",
  contactPhone: null,
  relationshipTier: null,
  sequenceId: null,
  paymentTerms: null,
  avgDaysToPay: null,
  totalOutstanding: 0,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...over,
});

const createMockRepo = (overrides: Partial<CustomerRepository> = {}): CustomerRepository => ({
  findManyByFilter: jest.fn(),
  findDetailById: jest.fn(),
  update: jest.fn(),
  tierBelongsToBusiness: jest.fn().mockResolvedValue(true),
  sequenceBelongsToBusiness: jest.fn().mockResolvedValue(true),
  ...overrides,
});

describe("UpdateCustomerUseCase", () => {
  it("assigns a sequence override to a customer", async () => {
    const updated = mkCustomer({ sequenceId: "seq-1" });
    const repo = createMockRepo({ update: jest.fn().mockResolvedValue(updated) });
    const useCase = new UpdateCustomerUseCase(repo);

    const result = await useCase.execute("cust-1", "biz-1", { sequenceId: "seq-1" });

    expect(result.sequenceId).toBe("seq-1");
    expect(repo.sequenceBelongsToBusiness).toHaveBeenCalledWith("seq-1", "biz-1");
    expect(repo.update).toHaveBeenCalledWith("cust-1", "biz-1", { sequenceId: "seq-1" });
  });

  it("assigns a relationship tier to a customer", async () => {
    const updated = mkCustomer({ relationshipTier: { id: "tier-1", name: "Standard" } });
    const repo = createMockRepo({ update: jest.fn().mockResolvedValue(updated) });
    const useCase = new UpdateCustomerUseCase(repo);

    const result = await useCase.execute("cust-1", "biz-1", { relationshipTierId: "tier-1" });

    expect(result.relationshipTier?.id).toBe("tier-1");
    expect(repo.tierBelongsToBusiness).toHaveBeenCalledWith("tier-1", "biz-1");
    expect(repo.update).toHaveBeenCalledWith("cust-1", "biz-1", { relationshipTierId: "tier-1" });
  });

  it("clears tier with null without calling the tier probe", async () => {
    const repo = createMockRepo({ update: jest.fn().mockResolvedValue(mkCustomer()) });
    const useCase = new UpdateCustomerUseCase(repo);

    await useCase.execute("cust-1", "biz-1", { relationshipTierId: null });

    expect(repo.tierBelongsToBusiness).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith("cust-1", "biz-1", { relationshipTierId: null });
  });

  it("clears sequence with null without calling the sequence probe", async () => {
    const repo = createMockRepo({ update: jest.fn().mockResolvedValue(mkCustomer()) });
    const useCase = new UpdateCustomerUseCase(repo);

    await useCase.execute("cust-1", "biz-1", { sequenceId: null });

    expect(repo.sequenceBelongsToBusiness).not.toHaveBeenCalled();
  });

  it("throws TierBelongsToDifferentBusinessError when tier is from another business", async () => {
    const repo = createMockRepo({
      tierBelongsToBusiness: jest.fn().mockResolvedValue(false),
    });
    const useCase = new UpdateCustomerUseCase(repo);

    await expect(
      useCase.execute("cust-1", "biz-1", { relationshipTierId: "tier-foreign" }),
    ).rejects.toBeInstanceOf(TierBelongsToDifferentBusinessError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("throws SequenceBelongsToDifferentBusinessError when sequence is from another business", async () => {
    const repo = createMockRepo({
      sequenceBelongsToBusiness: jest.fn().mockResolvedValue(false),
    });
    const useCase = new UpdateCustomerUseCase(repo);

    await expect(
      useCase.execute("cust-1", "biz-1", { sequenceId: "seq-foreign" }),
    ).rejects.toBeInstanceOf(SequenceBelongsToDifferentBusinessError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("throws CustomerNotFoundError for unknown customer", async () => {
    const repo = createMockRepo({
      update: jest.fn().mockRejectedValue(new CustomerNotFoundError("unknown-cust")),
    });
    const useCase = new UpdateCustomerUseCase(repo);

    await expect(
      useCase.execute("unknown-cust", "biz-1", { sequenceId: "seq-1" }),
    ).rejects.toThrow(CustomerNotFoundError);
  });
});
