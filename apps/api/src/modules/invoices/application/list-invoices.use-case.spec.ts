import { ListInvoicesUseCase } from "./list-invoices.use-case";
import type {
  InvoiceListFilter,
  InvoiceListResult,
  InvoiceRepository,
} from "../domain/invoice.repository";
import type { InvoiceListItem } from "../domain/invoice.entity";

const mkItem = (over: Partial<InvoiceListItem> = {}): InvoiceListItem => ({
  id: "inv-1",
  invoiceNumber: "INV-001",
  reference: null,
  description: null,
  status: "overdue",
  amountCents: 10_000,
  amountPaidCents: 0,
  balanceDueCents: 10_000,
  currency: "USD",
  daysOverdue: 5,
  dueDate: new Date("2026-05-01"),
  issuedDate: new Date("2026-04-15"),
  paymentLinkUrl: null,
  createdAt: new Date("2026-04-15T09:00:00Z"),
  updatedAt: new Date("2026-05-06T09:00:00Z"),
  customer: { id: "cust-1", companyName: "Acme Corp" },
  sequenceRun: null,
  ...over,
});

const createMockRepo = (
  overrides: Partial<InvoiceRepository> = {},
): InvoiceRepository => ({
  findManyByFilter: jest.fn().mockResolvedValue({
    items: [],
    total: 0,
    nextCursor: null,
  } satisfies InvoiceListResult),
  findDetailById: jest.fn(),
  findForPaymentLink: jest.fn(),
  updatePaymentLinkUrl: jest.fn(),
  ...overrides,
});

const baseFilter: InvoiceListFilter = {
  businessId: "biz-1",
  limit: 25,
  sortBy: "due_date",
  sortOrder: "desc",
};

describe("ListInvoicesUseCase", () => {
  it("returns items and cursor pagination metadata", async () => {
    const items = [mkItem(), mkItem({ id: "inv-2" })];
    const repo = createMockRepo({
      findManyByFilter: jest
        .fn()
        .mockResolvedValue({ items, total: 42, nextCursor: "inv-2" }),
    });
    const useCase = new ListInvoicesUseCase(repo);

    const result = await useCase.execute(baseFilter);

    expect(result.data).toEqual(items);
    expect(result.pagination).toEqual({
      limit: 25,
      total: 42,
      nextCursor: "inv-2",
      hasMore: true,
    });
  });

  it("reports hasMore=false when the repository returns no next cursor", async () => {
    const repo = createMockRepo({
      findManyByFilter: jest
        .fn()
        .mockResolvedValue({ items: [mkItem()], total: 1, nextCursor: null }),
    });
    const useCase = new ListInvoicesUseCase(repo);

    const result = await useCase.execute(baseFilter);

    expect(result.pagination.hasMore).toBe(false);
    expect(result.pagination.nextCursor).toBeNull();
  });

  it("forwards the filter to the repository unchanged", async () => {
    const repo = createMockRepo();
    const useCase = new ListInvoicesUseCase(repo);

    const filter: InvoiceListFilter = {
      ...baseFilter,
      cursor: "inv-9",
      limit: 10,
      status: "overdue",
      customerId: "cust-1",
      minAmount: 1000,
      maxAmount: 50_000,
      dueAfter: new Date("2026-04-01"),
      dueBefore: new Date("2026-06-01"),
      sortBy: "customer_name",
      sortOrder: "asc",
    };
    await useCase.execute(filter);

    expect(repo.findManyByFilter).toHaveBeenCalledWith(filter);
  });
});
