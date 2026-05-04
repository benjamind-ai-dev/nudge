import { UpdateCustomerUseCase } from "./update-customer.use-case";
import type { CustomerRepository } from "../domain/customer.repository";
import type { Customer } from "../domain/customer.entity";
import { CustomerNotFoundError } from "../domain/customer.errors";

const mkCustomer = (over: Partial<Customer> = {}): Customer => ({
  id: "cust-1",
  businessId: "biz-1",
  companyName: "Acme Corp",
  contactName: "John Doe",
  contactEmail: "john@acme.com",
  contactPhone: null,
  relationshipTierId: null,
  tierName: null,
  sequenceId: null,
  sequenceName: null,
  totalOutstanding: 0,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...over,
});

const createMockRepo = (overrides: Partial<CustomerRepository> = {}): CustomerRepository => ({
  findAllByBusiness: jest.fn().mockResolvedValue([]),
  update: jest.fn(),
  ...overrides,
});

describe("UpdateCustomerUseCase", () => {
  it("assigns a sequence override to a customer", async () => {
    const updated = mkCustomer({ sequenceId: "seq-1", sequenceName: "VIP Follow-Up" });
    const repo = createMockRepo({ update: jest.fn().mockResolvedValue(updated) });
    const useCase = new UpdateCustomerUseCase(repo);

    const result = await useCase.execute("cust-1", "biz-1", { sequenceId: "seq-1" });

    expect(result.sequenceId).toBe("seq-1");
    expect(result.sequenceName).toBe("VIP Follow-Up");
    expect(repo.update).toHaveBeenCalledWith("cust-1", "biz-1", { sequenceId: "seq-1" });
  });

  it("assigns a relationship tier to a customer", async () => {
    const updated = mkCustomer({ relationshipTierId: "tier-1", tierName: "Standard" });
    const repo = createMockRepo({ update: jest.fn().mockResolvedValue(updated) });
    const useCase = new UpdateCustomerUseCase(repo);

    const result = await useCase.execute("cust-1", "biz-1", { relationshipTierId: "tier-1" });

    expect(result.relationshipTierId).toBe("tier-1");
    expect(result.tierName).toBe("Standard");
    expect(repo.update).toHaveBeenCalledWith("cust-1", "biz-1", { relationshipTierId: "tier-1" });
  });

  it("throws CustomerNotFoundError for unknown customer", async () => {
    const repo = createMockRepo({
      update: jest.fn().mockRejectedValue(new CustomerNotFoundError("unknown-cust")),
    });
    const useCase = new UpdateCustomerUseCase(repo);

    await expect(useCase.execute("unknown-cust", "biz-1", { sequenceId: "seq-1" })).rejects.toThrow(
      CustomerNotFoundError,
    );
  });
});
