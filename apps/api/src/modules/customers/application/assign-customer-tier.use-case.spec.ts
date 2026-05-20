import { AssignCustomerTierUseCase } from "./assign-customer-tier.use-case";
import type { CustomerRepository } from "../domain/customer.repository";
import type { Customer } from "../domain/customer.entity";
import {
  CustomerNotFoundError,
  TierBelongsToDifferentBusinessError,
} from "../domain/customer.errors";

const mkCustomer = (over: Partial<Customer> = {}): Customer => ({
  id: "cust-1",
  businessId: "biz-1",
  companyName: "Acme Corp",
  contactName: null,
  contactEmail: null,
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
  sequenceBelongsToBusiness: jest.fn(),
  ...overrides,
});

describe("AssignCustomerTierUseCase", () => {
  it("assigns a tier when it belongs to the business", async () => {
    const updated = mkCustomer({ relationshipTier: { id: "tier-1", name: "Gold" } });
    const repo = createMockRepo({ update: jest.fn().mockResolvedValue(updated) });
    const useCase = new AssignCustomerTierUseCase(repo);

    const result = await useCase.execute("cust-1", "biz-1", "tier-1");

    expect(result.relationshipTier).toEqual({ id: "tier-1", name: "Gold" });
    expect(repo.tierBelongsToBusiness).toHaveBeenCalledWith("tier-1", "biz-1");
    expect(repo.update).toHaveBeenCalledWith("cust-1", "biz-1", { relationshipTierId: "tier-1" });
  });

  it("clears the tier when tierId is null and skips the probe", async () => {
    const updated = mkCustomer({ relationshipTier: null });
    const repo = createMockRepo({ update: jest.fn().mockResolvedValue(updated) });
    const useCase = new AssignCustomerTierUseCase(repo);

    const result = await useCase.execute("cust-1", "biz-1", null);

    expect(result.relationshipTier).toBeNull();
    expect(repo.tierBelongsToBusiness).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith("cust-1", "biz-1", { relationshipTierId: null });
  });

  it("throws TierBelongsToDifferentBusinessError when the tier is foreign", async () => {
    const repo = createMockRepo({
      tierBelongsToBusiness: jest.fn().mockResolvedValue(false),
    });
    const useCase = new AssignCustomerTierUseCase(repo);

    await expect(
      useCase.execute("cust-1", "biz-1", "tier-foreign"),
    ).rejects.toBeInstanceOf(TierBelongsToDifferentBusinessError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("propagates CustomerNotFoundError from the repo", async () => {
    const repo = createMockRepo({
      update: jest.fn().mockRejectedValue(new CustomerNotFoundError("cust-missing")),
    });
    const useCase = new AssignCustomerTierUseCase(repo);

    await expect(
      useCase.execute("cust-missing", "biz-1", "tier-1"),
    ).rejects.toThrow(CustomerNotFoundError);
  });
});
