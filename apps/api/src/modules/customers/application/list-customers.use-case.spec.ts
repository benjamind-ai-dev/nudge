import { ListCustomersUseCase } from "./list-customers.use-case";
import type {
  CustomerListFilter,
  CustomerListResult,
  CustomerRepository,
} from "../domain/customer.repository";
import type { Customer } from "../domain/customer.entity";

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
  findManyByFilter: jest
    .fn()
    .mockResolvedValue({ items: [], total: 0 } satisfies CustomerListResult),
  findDetailById: jest.fn(),
  update: jest.fn(),
  tierBelongsToBusiness: jest.fn(),
  sequenceBelongsToBusiness: jest.fn(),
  ...overrides,
});

const baseFilter: CustomerListFilter = {
  businessId: "biz-1",
  page: 1,
  limit: 25,
  includeInactive: false,
  sortBy: "company_name",
  sortOrder: "asc",
};

describe("ListCustomersUseCase", () => {
  it("returns items and pagination metadata", async () => {
    const items = [mkCustomer(), mkCustomer({ id: "cust-2" })];
    const repo = createMockRepo({
      findManyByFilter: jest.fn().mockResolvedValue({ items, total: 42 }),
    });
    const useCase = new ListCustomersUseCase(repo);

    const result = await useCase.execute(baseFilter);

    expect(result.data).toEqual(items);
    expect(result.pagination).toEqual({ page: 1, limit: 25, total: 42, totalPages: 2 });
  });

  it("forwards the filter to the repository unchanged", async () => {
    const repo = createMockRepo();
    const useCase = new ListCustomersUseCase(repo);

    const filter: CustomerListFilter = {
      ...baseFilter,
      page: 2,
      limit: 10,
      search: "acme",
      tierId: "tier-1",
      hasOverdue: true,
      includeInactive: true,
      sortBy: "total_outstanding",
      sortOrder: "desc",
    };
    await useCase.execute(filter);

    expect(repo.findManyByFilter).toHaveBeenCalledWith(filter);
  });

  it("computes totalPages = 1 when total is zero", async () => {
    const repo = createMockRepo();
    const useCase = new ListCustomersUseCase(repo);
    const result = await useCase.execute(baseFilter);
    expect(result.pagination.totalPages).toBe(1);
  });

  it("rounds totalPages up", async () => {
    const repo = createMockRepo({
      findManyByFilter: jest.fn().mockResolvedValue({ items: [], total: 26 }),
    });
    const useCase = new ListCustomersUseCase(repo);
    const result = await useCase.execute(baseFilter);
    expect(result.pagination.totalPages).toBe(2);
  });
});
