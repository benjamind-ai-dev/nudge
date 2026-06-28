import { GetInvoiceUseCase } from "./get-invoice.use-case";
import type { InvoiceRepository } from "../domain/invoice.repository";
import type { InvoiceDetail } from "../domain/invoice.entity";
import { InvoiceNotFoundError } from "../domain/invoice.errors";

const mkDetail = (over: Partial<InvoiceDetail> = {}): InvoiceDetail => ({
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
  paidAt: null,
  paymentLinkUrl: null,
  aiPaymentScore: null,
  aiScoreReason: null,
  createdAt: new Date("2026-04-15T09:00:00Z"),
  updatedAt: new Date("2026-05-06T09:00:00Z"),
  customer: {
    id: "cust-1",
    companyName: "Acme Corp",
    contactName: "Jane",
    contactEmail: "jane@acme.example",
    contactPhone: null,
    paymentTerms: "net30",
  },
  sequenceRun: null,
  messages: [],
  ...over,
});

const createMockRepo = (
  overrides: Partial<InvoiceRepository> = {},
): InvoiceRepository => ({
  findManyByFilter: jest.fn(),
  findDetailById: jest.fn().mockResolvedValue(null),
  findForPaymentLink: jest.fn(),
  updatePaymentLinkUrl: jest.fn(),
  ...overrides,
});

describe("GetInvoiceUseCase", () => {
  it("returns the invoice detail when found", async () => {
    const detail = mkDetail();
    const repo = createMockRepo({
      findDetailById: jest.fn().mockResolvedValue(detail),
    });
    const useCase = new GetInvoiceUseCase(repo);

    const result = await useCase.execute("inv-1", "biz-1");

    expect(result).toEqual(detail);
    expect(repo.findDetailById).toHaveBeenCalledWith("inv-1", "biz-1");
  });

  it("throws InvoiceNotFoundError when the repo returns null", async () => {
    const repo = createMockRepo();
    const useCase = new GetInvoiceUseCase(repo);

    await expect(useCase.execute("missing", "biz-1")).rejects.toThrow(
      InvoiceNotFoundError,
    );
  });
});
