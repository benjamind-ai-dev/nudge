import { GetCustomerUseCase } from "./get-customer.use-case";
import type { CustomerRepository } from "../domain/customer.repository";
import type { CustomerDetail } from "../domain/customer.entity";
import { CustomerNotFoundError } from "../domain/customer.errors";

const mkDetail = (over: Partial<CustomerDetail> = {}): CustomerDetail => ({
  id: "cust-1",
  businessId: "biz-1",
  companyName: "Acme Corp",
  contactName: "Jane",
  contactEmail: "jane@acme.example",
  contactPhone: null,
  relationshipTier: null,
  sequenceId: null,
  paymentTerms: "net30",
  avgDaysToPay: 14.5,
  totalOutstanding: 25_000,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-05-01"),
  recentInvoices: [],
  activeSequenceRunCount: 0,
  lastMessageSentAt: null,
  ...over,
});

const createMockRepo = (overrides: Partial<CustomerRepository> = {}): CustomerRepository => ({
  findManyByFilter: jest.fn(),
  findDetailById: jest.fn().mockResolvedValue(null),
  update: jest.fn(),
  tierBelongsToBusiness: jest.fn(),
  sequenceBelongsToBusiness: jest.fn(),
  ...overrides,
});

describe("GetCustomerUseCase", () => {
  it("returns the customer detail when found", async () => {
    const detail = mkDetail();
    const repo = createMockRepo({
      findDetailById: jest.fn().mockResolvedValue(detail),
    });
    const useCase = new GetCustomerUseCase(repo);

    const result = await useCase.execute("cust-1", "biz-1");

    expect(result).toEqual(detail);
    expect(repo.findDetailById).toHaveBeenCalledWith("cust-1", "biz-1");
  });

  it("throws CustomerNotFoundError when the repo returns null", async () => {
    const repo = createMockRepo();
    const useCase = new GetCustomerUseCase(repo);

    await expect(useCase.execute("missing", "biz-1")).rejects.toThrow(CustomerNotFoundError);
  });
});
