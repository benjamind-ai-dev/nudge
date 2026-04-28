import { Logger } from "@nestjs/common";
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
  PriorInvoiceState,
} from "../domain/canonical-invoice";
import { deriveStatus, detectInvoiceTransition } from "../domain/canonical-invoice";

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
  issuedDate: new Date("2026-04-01"),
  dueDate: new Date("2026-05-01"),
  lifecycle: "active",
  // Must be after the 90-day null-cursor fallback (NOW minus 90 days =
  // 2026-01-21) so cursor-advance tests actually advance.
  lastUpdatedAt: new Date("2026-04-05"),
  ...over,
});

const mkCustomer = (id = "C1"): CanonicalCustomer => ({
  externalId: id,
  companyName: "Acme",
  contactName: null,
  contactEmail: null,
  contactPhone: null,
});

const defaultApplyChangeResult = {
  invoiceId: "local-inv-1",
  stoppedSequenceRunIds: [] as string[],
};

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
      updateSyncCursor: jest.fn(),
    } as unknown as jest.Mocked<SyncConnectionReader>;
    invoiceRepo = {
      findStatusesByExternalIds: jest.fn().mockResolvedValue(new Map()),
      upsertMany: jest.fn().mockResolvedValue(undefined),
      findPriorStatesByExternalIds: jest.fn().mockResolvedValue(new Map()),
      applyChange: jest.fn().mockResolvedValue(defaultApplyChangeResult),
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

  it("syncs a single page happy path: upserts customers → applyChange per invoice → cursor", async () => {
    reader.findById.mockResolvedValue(mkConnection());
    const inv = mkInvoice();
    provider.fetchPage.mockResolvedValueOnce({
      invoices: [inv],
      customers: [mkCustomer()],
      hasMore: false,
    });

    await useCase.execute("conn-1");

    expect(customerRepo.upsertMany).toHaveBeenCalledWith("biz-1", "quickbooks", [mkCustomer()]);
    expect(invoiceRepo.findPriorStatesByExternalIds).toHaveBeenCalledWith("biz-1", ["inv_1"]);
    expect(invoiceRepo.applyChange).toHaveBeenCalledTimes(1);
    expect(invoiceRepo.applyChange).toHaveBeenCalledWith("biz-1", {
      externalId: inv.externalId,
      customerExternalId: inv.customerExternalId,
      invoice: inv,
      newStatus: deriveStatus(inv, NOW),
      transition: detectInvoiceTransition(undefined, inv, NOW),
      provider: "quickbooks",
      lastSyncedAt: NOW,
    });
    expect(customerRepo.recalculateTotalOutstanding).not.toHaveBeenCalled();
    expect(reader.updateSyncCursor).toHaveBeenCalledWith(
      "conn-1",
      new Date("2026-04-05"),
    );
  });

  it("paginates: continues with offset += page.invoices.length while hasMore", async () => {
    reader.findById.mockResolvedValue(mkConnection());
    const a = mkInvoice({ externalId: "a" });
    const b = mkInvoice({
      externalId: "b",
      lastUpdatedAt: new Date("2026-04-06"),
    });
    provider.fetchPage
      .mockResolvedValueOnce({
        invoices: [a],
        customers: [mkCustomer()],
        hasMore: true,
      })
      .mockResolvedValueOnce({
        invoices: [b],
        customers: [mkCustomer()],
        hasMore: false,
      });

    await useCase.execute("conn-1");

    expect(provider.fetchPage).toHaveBeenCalledTimes(2);
    expect(provider.fetchPage.mock.calls[0][0].offset).toBe(0);
    expect(provider.fetchPage.mock.calls[1][0].offset).toBe(1);
    expect(invoiceRepo.applyChange).toHaveBeenCalledTimes(2);
    expect(reader.updateSyncCursor).toHaveBeenCalledWith(
      "conn-1",
      new Date("2026-04-06"),
    );
  });

  it("uses 'now - 90 days' when syncCursor is null (first sync)", async () => {
    reader.findById.mockResolvedValue(mkConnection({ syncCursor: null }));
    provider.fetchPage.mockResolvedValueOnce({
      invoices: [],
      customers: [],
      hasMore: false,
    });

    await useCase.execute("conn-1");

    const expected = new Date(NOW.getTime() - 90 * 24 * 60 * 60_000);
    expect(provider.fetchPage.mock.calls[0][0].cursor.toISOString()).toBe(
      expected.toISOString(),
    );
  });

  it("pre-flight refreshes when tokenExpiresAt is within 5 min of now", async () => {
    const soon = new Date(NOW.getTime() + 2 * 60_000);
    reader.findById
      .mockResolvedValueOnce(mkConnection({ tokenExpiresAt: soon }))
      .mockResolvedValueOnce(mkConnection({ tokenExpiresAt: new Date(NOW.getTime() + 60 * 60_000) }));
    provider.fetchPage.mockResolvedValueOnce({ invoices: [], customers: [], hasMore: false });

    await useCase.execute("conn-1");

    expect(refresh.execute).toHaveBeenCalledWith("conn-1");
  });

  it("on AuthError: refreshes, reloads, retries page once → succeeds", async () => {
    reader.findById.mockResolvedValue(mkConnection()); // initial load + after refresh
    const inv = mkInvoice();
    provider.fetchPage
      .mockRejectedValueOnce(new AuthError())
      .mockResolvedValueOnce({
        invoices: [inv],
        customers: [mkCustomer()],
        hasMore: false,
      });

    await useCase.execute("conn-1");
    expect(refresh.execute).toHaveBeenCalledTimes(1);
    expect(provider.fetchPage).toHaveBeenCalledTimes(2);
    expect(invoiceRepo.applyChange).toHaveBeenCalledTimes(1);
  });

  it("on AuthError + refresh leaves connection status != 'connected': throws UnrecoverableError", async () => {
    reader.findById
      .mockResolvedValueOnce(mkConnection())
      .mockResolvedValueOnce(mkConnection({ status: "revoked" }));
    provider.fetchPage.mockRejectedValueOnce(new AuthError());

    await expect(useCase.execute("conn-1")).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it("on RateLimitError: sleeps then retries same page with same offset", async () => {
    reader.findById.mockResolvedValue(mkConnection());
    provider.fetchPage
      .mockRejectedValueOnce(new RateLimitError(1_000))
      .mockResolvedValueOnce({ invoices: [], customers: [], hasMore: false });

    const p = useCase.execute("conn-1");
    await jest.advanceTimersByTimeAsync(1_000);
    await p;

    expect(provider.fetchPage).toHaveBeenCalledTimes(2);
    expect(provider.fetchPage.mock.calls[1][0].offset).toBe(0);
  });

  it("fully_paid transition: logs invoice_payment_detected with stoppedSequenceRunIds", async () => {
    const logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});

    reader.findById.mockResolvedValue(mkConnection());
    const prior: PriorInvoiceState = { status: "overdue", balanceDueCents: 10_000 };
    invoiceRepo.findPriorStatesByExternalIds.mockResolvedValue(
      new Map<string, PriorInvoiceState>([["inv_1", prior]]),
    );
    const inv = mkInvoice({ balanceDueCents: 0, amountPaidCents: 10_000 });
    invoiceRepo.applyChange.mockResolvedValueOnce({
      invoiceId: "inv-db-1",
      stoppedSequenceRunIds: ["run-1"],
    });

    provider.fetchPage.mockResolvedValueOnce({
      invoices: [inv],
      customers: [mkCustomer()],
      hasMore: false,
    });

    await useCase.execute("conn-1");

    const expectedTransition = detectInvoiceTransition(prior, inv, NOW);
    expect(expectedTransition.kind).toBe("fully_paid");

    expect(invoiceRepo.applyChange).toHaveBeenCalledWith(
      "biz-1",
      expect.objectContaining({
        transition: expectedTransition,
        newStatus: "paid",
      }),
    );

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "invoice_payment_detected",
        businessId: "biz-1",
        invoiceId: "inv-db-1",
        externalId: "inv_1",
        invoiceNumber: "1001",
        priorBalance: 10_000,
        amountPaid: 10_000,
        stoppedSequenceRunIds: ["run-1"],
      }),
    );

    logSpy.mockRestore();
  });

  it("prior paid: transition is no_change — applyChange still runs with no_change", async () => {
    reader.findById.mockResolvedValue(mkConnection());
    const prior: PriorInvoiceState = { status: "paid", balanceDueCents: 0 };
    invoiceRepo.findPriorStatesByExternalIds.mockResolvedValue(
      new Map<string, PriorInvoiceState>([["inv_1", prior]]),
    );
    const inv = mkInvoice({ balanceDueCents: 0, amountPaidCents: 10_000 });
    provider.fetchPage.mockResolvedValueOnce({
      invoices: [inv],
      customers: [mkCustomer()],
      hasMore: false,
    });

    await useCase.execute("conn-1");

    expect(invoiceRepo.applyChange).toHaveBeenCalledWith("biz-1", {
      externalId: inv.externalId,
      customerExternalId: inv.customerExternalId,
      invoice: inv,
      newStatus: deriveStatus(inv, NOW),
      transition: { kind: "no_change" },
      provider: "quickbooks",
      lastSyncedAt: NOW,
    });
  });

  it("voided transition: logs invoice_voided with stoppedSequenceRunIds", async () => {
    const logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});

    reader.findById.mockResolvedValue(mkConnection());
    const prior: PriorInvoiceState = { status: "open", balanceDueCents: 10_000 };
    invoiceRepo.findPriorStatesByExternalIds.mockResolvedValue(
      new Map<string, PriorInvoiceState>([["inv_1", prior]]),
    );
    const inv = mkInvoice({
      lifecycle: "voided",
      balanceDueCents: 0,
      amountPaidCents: 0,
    });
    invoiceRepo.applyChange.mockResolvedValueOnce({
      invoiceId: "inv-db-void",
      stoppedSequenceRunIds: ["run-void-1"],
    });

    provider.fetchPage.mockResolvedValueOnce({
      invoices: [inv],
      customers: [mkCustomer()],
      hasMore: false,
    });

    await useCase.execute("conn-1");

    const expectedTransition = detectInvoiceTransition(prior, inv, NOW);
    expect(expectedTransition.kind).toBe("voided");

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "invoice_voided",
        businessId: "biz-1",
        invoiceId: "inv-db-void",
        externalId: "inv_1",
        priorStatus: "open",
        priorBalance: 10_000,
        stoppedSequenceRunIds: ["run-void-1"],
      }),
    );

    logSpy.mockRestore();
  });

  it("continues processing remaining invoices when applyChange throws on one", async () => {
    const logSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});

    reader.findById.mockResolvedValue(mkConnection());
    const first = mkInvoice({
      externalId: "inv_bad",
      invoiceNumber: "BAD",
      lastUpdatedAt: new Date("2026-04-05"),
    });
    const second = mkInvoice({
      externalId: "inv_ok",
      invoiceNumber: "OK",
      lastUpdatedAt: new Date("2026-04-10"),
    });
    invoiceRepo.findPriorStatesByExternalIds.mockResolvedValue(
      new Map<string, PriorInvoiceState>([
        ["inv_bad", { status: "open", balanceDueCents: 10_000 }],
        ["inv_ok", { status: "open", balanceDueCents: 10_000 }],
      ]),
    );
    invoiceRepo.applyChange
      .mockRejectedValueOnce(new Error("orphan customer"))
      .mockResolvedValueOnce(defaultApplyChangeResult);

    provider.fetchPage.mockResolvedValueOnce({
      invoices: [first, second],
      customers: [mkCustomer()],
      hasMore: false,
    });

    await expect(useCase.execute("conn-1")).resolves.toBeUndefined();

    expect(invoiceRepo.applyChange).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "invoice_apply_failed",
        businessId: "biz-1",
        externalId: "inv_bad",
        invoiceNumber: "BAD",
        customerExternalId: "C1",
        error: "orphan customer",
      }),
    );
    expect(reader.updateSyncCursor).toHaveBeenCalledWith(
      "conn-1",
      new Date("2026-04-10"),
    );

    logSpy.mockRestore();
  });

  it("breaks the loop when provider returns empty page with hasMore=true (defensive guard)", async () => {
    reader.findById.mockResolvedValue(mkConnection());
    provider.fetchPage.mockResolvedValueOnce({
      invoices: [],
      customers: [],
      hasMore: true,
    });

    await useCase.execute("conn-1");

    expect(provider.fetchPage).toHaveBeenCalledTimes(1);
    expect(invoiceRepo.applyChange).not.toHaveBeenCalled();
    expect(reader.updateSyncCursor).not.toHaveBeenCalled();
  });
});
