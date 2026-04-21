import { UnrecoverableError } from "bullmq";
import type {
  Connection,
  ProviderName,
  ProviderTokens,
} from "@nudge/connections-domain";
import { SyncBusinessInvoicesUseCase } from "./sync-business-invoices.use-case";
import {
  AuthError,
  RateLimitError,
  type InvoiceSyncProvider,
  type InvoiceSyncProviderMap,
} from "../domain/invoice-sync.provider";
import type {
  CustomerRepository,
  InvoiceRepository,
  SyncConnectionReader,
} from "../domain/repositories";
import type {
  CanonicalCustomer,
  CanonicalInvoice,
  InvoiceStatus,
} from "../domain/canonical-invoice";

type RefreshTokenUseCaseLike = { execute: (id: string) => Promise<void> };

const NOW = new Date("2026-04-21T12:00:00Z");

const mkConnection = (over: Partial<Record<string, unknown>> = {}): Connection => {
  const tokens: ProviderTokens = {
    accessToken: "access",
    refreshToken: "refresh",
    expiresAt: new Date(NOW.getTime() + 60 * 60_000),
  };
  return {
    id: "conn-1",
    businessId: "biz-1",
    provider: "quickbooks" as ProviderName,
    status: "connected",
    externalTenantId: "realm-1",
    tokenExpiresAt: tokens.expiresAt,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    syncCursor: null,
    ...over,
  } as unknown as Connection;
};

const mkInvoice = (over: Partial<CanonicalInvoice> = {}): CanonicalInvoice => ({
  externalId: "inv_1",
  invoiceNumber: "1001",
  customerExternalId: "C1",
  amountCents: 10_000,
  amountPaidCents: 0,
  balanceDueCents: 10_000,
  currency: "USD",
  paymentLinkUrl: null,
  issuedDate: new Date("2026-01-01"),
  dueDate: new Date("2026-02-01"),
  lifecycle: "active",
  lastUpdatedAt: new Date("2026-01-05"),
  ...over,
});

const mkCustomer = (id = "C1"): CanonicalCustomer => ({
  externalId: id,
  companyName: "Acme",
  contactName: null,
  contactEmail: null,
  contactPhone: null,
});

describe("SyncBusinessInvoicesUseCase", () => {
  let provider: jest.Mocked<InvoiceSyncProvider>;
  let providers: InvoiceSyncProviderMap;
  let reader: jest.Mocked<SyncConnectionReader>;
  let invoiceRepo: jest.Mocked<InvoiceRepository>;
  let customerRepo: jest.Mocked<CustomerRepository>;
  let refresh: jest.Mocked<RefreshTokenUseCaseLike>;
  let useCase: SyncBusinessInvoicesUseCase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);

    provider = {
      name: "quickbooks",
      fetchPage: jest.fn(),
    } as unknown as jest.Mocked<InvoiceSyncProvider>;
    providers = { quickbooks: provider };
    reader = {
      findAllSyncable: jest.fn(),
      findById: jest.fn(),
      findLatestConnectedByBusiness: jest.fn(),
      updateSyncCursor: jest.fn(),
    } as unknown as jest.Mocked<SyncConnectionReader>;
    invoiceRepo = {
      findStatusesByExternalIds: jest.fn().mockResolvedValue(new Map()),
      upsertMany: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<InvoiceRepository>;
    customerRepo = {
      upsertMany: jest.fn().mockResolvedValue(undefined),
      recalculateTotalOutstanding: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CustomerRepository>;
    refresh = { execute: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<RefreshTokenUseCaseLike>;

    useCase = new SyncBusinessInvoicesUseCase(
      reader,
      providers,
      invoiceRepo,
      customerRepo,
      refresh as unknown as import("../../token-refresh/application/refresh-token.use-case").RefreshTokenUseCase,
    );
  });

  afterEach(() => jest.useRealTimers());

  it("syncs a single page happy path: upserts customers → invoices → recalc → cursor", async () => {
    reader.findLatestConnectedByBusiness.mockResolvedValue(mkConnection());
    provider.fetchPage.mockResolvedValueOnce({
      invoices: [mkInvoice()],
      customers: [mkCustomer()],
      hasMore: false,
    });

    await useCase.execute("biz-1");

    expect(customerRepo.upsertMany).toHaveBeenCalledWith("biz-1", "quickbooks", [mkCustomer()]);
    expect(invoiceRepo.upsertMany).toHaveBeenCalledTimes(1);
    const rows = invoiceRepo.upsertMany.mock.calls[0][1];
    expect(rows[0].provider).toBe("quickbooks");
    expect(rows[0].paymentLinkUrl).toBeNull();
    expect(customerRepo.recalculateTotalOutstanding).toHaveBeenCalledWith(
      "biz-1",
      ["C1"],
    );
    expect(reader.updateSyncCursor).toHaveBeenCalledWith(
      "conn-1",
      new Date("2026-01-05"),
    );
  });

  it("paginates: continues with offset += page.invoices.length while hasMore", async () => {
    reader.findLatestConnectedByBusiness.mockResolvedValue(mkConnection());
    provider.fetchPage
      .mockResolvedValueOnce({
        invoices: [mkInvoice({ externalId: "a" })],
        customers: [mkCustomer()],
        hasMore: true,
      })
      .mockResolvedValueOnce({
        invoices: [
          mkInvoice({
            externalId: "b",
            lastUpdatedAt: new Date("2026-01-06"),
          }),
        ],
        customers: [mkCustomer()],
        hasMore: false,
      });

    await useCase.execute("biz-1");

    expect(provider.fetchPage).toHaveBeenCalledTimes(2);
    expect(provider.fetchPage.mock.calls[0][0].offset).toBe(0);
    expect(provider.fetchPage.mock.calls[1][0].offset).toBe(1);
    expect(reader.updateSyncCursor).toHaveBeenCalledWith(
      "conn-1",
      new Date("2026-01-06"),
    );
  });

  it("uses 'now - 1 year' when syncCursor is null (first sync)", async () => {
    reader.findLatestConnectedByBusiness.mockResolvedValue(mkConnection({ syncCursor: null }));
    provider.fetchPage.mockResolvedValueOnce({
      invoices: [],
      customers: [],
      hasMore: false,
    });

    await useCase.execute("biz-1");

    const expected = new Date(NOW);
    expected.setUTCFullYear(expected.getUTCFullYear() - 1);
    expect(provider.fetchPage.mock.calls[0][0].cursor.toISOString()).toBe(
      expected.toISOString(),
    );
  });

  it("pre-flight refreshes when tokenExpiresAt is within 5 min of now", async () => {
    const soon = new Date(NOW.getTime() + 2 * 60_000);
    reader.findLatestConnectedByBusiness.mockResolvedValueOnce(mkConnection({ tokenExpiresAt: soon }));
    reader.findById.mockResolvedValueOnce(mkConnection({ tokenExpiresAt: new Date(NOW.getTime() + 60 * 60_000) }));
    provider.fetchPage.mockResolvedValueOnce({ invoices: [], customers: [], hasMore: false });

    await useCase.execute("biz-1");

    expect(refresh.execute).toHaveBeenCalledWith("conn-1");
  });

  it("on AuthError: refreshes, reloads, retries page once → succeeds", async () => {
    reader.findLatestConnectedByBusiness.mockResolvedValue(mkConnection());
    reader.findById.mockResolvedValue(mkConnection()); // after refresh
    provider.fetchPage
      .mockRejectedValueOnce(new AuthError())
      .mockResolvedValueOnce({
        invoices: [mkInvoice()],
        customers: [mkCustomer()],
        hasMore: false,
      });

    await useCase.execute("biz-1");
    expect(refresh.execute).toHaveBeenCalledTimes(1);
    expect(provider.fetchPage).toHaveBeenCalledTimes(2);
  });

  it("on AuthError + refresh leaves connection status != 'connected': throws UnrecoverableError", async () => {
    reader.findLatestConnectedByBusiness.mockResolvedValue(mkConnection());
    reader.findById.mockResolvedValue(mkConnection({ status: "revoked" }));
    provider.fetchPage.mockRejectedValueOnce(new AuthError());

    await expect(useCase.execute("biz-1")).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it("on RateLimitError: sleeps then retries same page with same offset", async () => {
    reader.findLatestConnectedByBusiness.mockResolvedValue(mkConnection());
    provider.fetchPage
      .mockRejectedValueOnce(new RateLimitError(1_000))
      .mockResolvedValueOnce({ invoices: [], customers: [], hasMore: false });

    const p = useCase.execute("biz-1");
    await jest.advanceTimersByTimeAsync(1_000);
    await p;

    expect(provider.fetchPage).toHaveBeenCalledTimes(2);
    expect(provider.fetchPage.mock.calls[1][0].offset).toBe(0);
  });

  it("payment transition: prior 'overdue' + new 'paid' → upsert row carries paidAtIfNewlyPaid", async () => {
    reader.findLatestConnectedByBusiness.mockResolvedValue(mkConnection());
    invoiceRepo.findStatusesByExternalIds.mockResolvedValue(
      new Map<string, InvoiceStatus>([["inv_1", "overdue"]]),
    );
    provider.fetchPage.mockResolvedValueOnce({
      invoices: [mkInvoice({ balanceDueCents: 0, amountPaidCents: 10_000 })],
      customers: [mkCustomer()],
      hasMore: false,
    });

    await useCase.execute("biz-1");

    const rows = invoiceRepo.upsertMany.mock.calls[0][1];
    expect(rows[0].status).toBe("paid");
    expect(rows[0].paidAtIfNewlyPaid).toEqual(NOW);
  });

  it("no payment transition: prior 'paid' + new 'paid' → paidAtIfNewlyPaid is undefined", async () => {
    reader.findLatestConnectedByBusiness.mockResolvedValue(mkConnection());
    invoiceRepo.findStatusesByExternalIds.mockResolvedValue(
      new Map<string, InvoiceStatus>([["inv_1", "paid"]]),
    );
    provider.fetchPage.mockResolvedValueOnce({
      invoices: [mkInvoice({ balanceDueCents: 0, amountPaidCents: 10_000 })],
      customers: [mkCustomer()],
      hasMore: false,
    });

    await useCase.execute("biz-1");

    const rows = invoiceRepo.upsertMany.mock.calls[0][1];
    expect(rows[0].paidAtIfNewlyPaid).toBeUndefined();
  });

  it("breaks the loop when provider returns empty page with hasMore=true (defensive guard)", async () => {
    reader.findLatestConnectedByBusiness.mockResolvedValue(mkConnection());
    provider.fetchPage.mockResolvedValueOnce({
      invoices: [],
      customers: [],
      hasMore: true,
    });

    await useCase.execute("biz-1");

    expect(provider.fetchPage).toHaveBeenCalledTimes(1);
    expect(invoiceRepo.upsertMany).not.toHaveBeenCalled();
    expect(reader.updateSyncCursor).not.toHaveBeenCalled();
  });
});
