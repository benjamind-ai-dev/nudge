import { Logger } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";
import type {
  Connection,
  ProviderName,
  ProviderTokens,
} from "@nudge/connections-domain";
import { SyncSingleXeroInvoiceUseCase } from "./sync-single-xero-invoice.use-case";
import {
  AuthError,
  RateLimitError,
} from "../../invoice-sync/domain/invoice-sync.provider";
import type {
  CustomerRepository,
  InvoiceRepository,
  SyncConnectionReader,
} from "../../invoice-sync/domain/repositories";
import {
  deriveStatus,
  detectInvoiceTransition,
  type CanonicalCustomer,
  type CanonicalInvoice,
  type PriorInvoiceState,
} from "../../invoice-sync/domain/canonical-invoice";
import type { XeroInvoiceSyncProvider } from "../../invoice-sync/infrastructure/xero-invoice-sync.provider";
import type { RefreshTokenUseCase } from "../../token-refresh/application/refresh-token.use-case";

type RefreshTokenUseCaseLike = { execute: (id: string) => Promise<void> };

const NOW = new Date("2026-04-26T12:00:00Z");

const mkConnection = (
  over: Partial<Record<string, unknown>> = {},
): Connection => {
  const tokens: ProviderTokens = {
    accessToken: "access",
    refreshToken: "refresh",
    expiresAt: new Date(NOW.getTime() + 60 * 60_000),
  };
  return {
    id: "conn-1",
    businessId: "biz-1",
    provider: "xero" as ProviderName,
    status: "connected",
    externalTenantId: "tenant-1",
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
  lastUpdatedAt: new Date("2026-04-26T11:00:00Z"),
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

describe("SyncSingleXeroInvoiceUseCase", () => {
  let xero: jest.Mocked<
    Pick<XeroInvoiceSyncProvider, "fetchInvoice" | "fetchContactById" | "name">
  >;
  let reader: jest.Mocked<SyncConnectionReader>;
  let invoiceRepo: jest.Mocked<InvoiceRepository>;
  let customerRepo: jest.Mocked<CustomerRepository>;
  let refresh: jest.Mocked<RefreshTokenUseCaseLike>;
  let useCase: SyncSingleXeroInvoiceUseCase;

  const job = {
    connectionId: "conn-1",
    tenantId: "tenant-1",
    externalInvoiceId: "inv_1",
    eventCategory: "INVOICE",
    eventType: "UPDATE",
    occurredAt: NOW.toISOString(),
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);

    xero = {
      name: "xero",
      fetchInvoice: jest.fn(),
      fetchContactById: jest.fn(),
    } as unknown as jest.Mocked<
      Pick<
        XeroInvoiceSyncProvider,
        "fetchInvoice" | "fetchContactById" | "name"
      >
    >;

    reader = {
      findAllSyncable: jest.fn(),
      findById: jest.fn(),
      updateSyncCursor: jest.fn(),
    } as unknown as jest.Mocked<SyncConnectionReader>;

    invoiceRepo = {
      findPriorStatesByExternalIds: jest.fn().mockResolvedValue(new Map()),
      applyChange: jest.fn().mockResolvedValue(defaultApplyChangeResult),
    } as unknown as jest.Mocked<InvoiceRepository>;

    customerRepo = {
      upsertMany: jest.fn().mockResolvedValue(undefined),
      existsByExternalId: jest.fn(),
    } as unknown as jest.Mocked<CustomerRepository>;

    refresh = { execute: jest.fn().mockResolvedValue(undefined) };

    useCase = new SyncSingleXeroInvoiceUseCase(
      reader,
      xero as unknown as XeroInvoiceSyncProvider,
      invoiceRepo,
      customerRepo,
      refresh as unknown as RefreshTokenUseCase,
    );
  });

  afterEach(() => jest.useRealTimers());

  it("skips with log when connection is not found", async () => {
    reader.findById.mockResolvedValueOnce(null);
    await useCase.execute(job);
    expect(xero.fetchInvoice).not.toHaveBeenCalled();
    expect(invoiceRepo.applyChange).not.toHaveBeenCalled();
  });

  it("skips with log when connection.status is not 'connected'", async () => {
    reader.findById.mockResolvedValueOnce(
      mkConnection({ status: "expired" }),
    );
    await useCase.execute(job);
    expect(xero.fetchInvoice).not.toHaveBeenCalled();
  });

  it("skips with log when connection provider is not 'xero'", async () => {
    reader.findById.mockResolvedValueOnce(
      mkConnection({ provider: "quickbooks" as ProviderName }),
    );
    await useCase.execute(job);
    expect(xero.fetchInvoice).not.toHaveBeenCalled();
  });

  it("happy path: fetches invoice + skips customer fetch when customer exists locally + applyChange", async () => {
    reader.findById.mockResolvedValueOnce(mkConnection());
    customerRepo.existsByExternalId.mockResolvedValueOnce(true);
    const inv = mkInvoice();
    xero.fetchInvoice.mockResolvedValueOnce(inv);

    await useCase.execute(job);

    expect(xero.fetchInvoice).toHaveBeenCalledWith({
      tokens: expect.any(Object),
      tenantId: "tenant-1",
      invoiceId: "inv_1",
    });
    expect(xero.fetchContactById).not.toHaveBeenCalled();
    expect(customerRepo.upsertMany).not.toHaveBeenCalled();
    expect(invoiceRepo.findPriorStatesByExternalIds).toHaveBeenCalledWith(
      "biz-1",
      ["inv_1"],
    );
    expect(invoiceRepo.applyChange).toHaveBeenCalledTimes(1);
    expect(invoiceRepo.applyChange).toHaveBeenCalledWith("biz-1", {
      externalId: inv.externalId,
      customerExternalId: inv.customerExternalId,
      invoice: inv,
      newStatus: deriveStatus(inv, NOW),
      transition: detectInvoiceTransition(undefined, inv, NOW),
      provider: "xero",
      lastSyncedAt: NOW,
    });
  });

  it("conditional fetch: when customer is missing locally, fetches & upserts customer first", async () => {
    reader.findById.mockResolvedValueOnce(mkConnection());
    customerRepo.existsByExternalId.mockResolvedValueOnce(false);
    xero.fetchContactById.mockResolvedValueOnce(mkCustomer("C1"));
    const inv = mkInvoice();
    xero.fetchInvoice.mockResolvedValueOnce(inv);

    await useCase.execute(job);

    expect(xero.fetchContactById).toHaveBeenCalledWith({
      tokens: expect.any(Object),
      tenantId: "tenant-1",
      contactId: "C1",
    });
    expect(customerRepo.upsertMany).toHaveBeenCalledWith(
      "biz-1",
      "xero",
      [expect.objectContaining({ externalId: "C1" })],
    );
    const upsertCallOrder = customerRepo.upsertMany.mock.invocationCallOrder[0];
    const applyOrder = invoiceRepo.applyChange.mock.invocationCallOrder[0];
    expect(upsertCallOrder).toBeLessThan(applyOrder);
  });

  it("payment-transition: prior=open, new=paid — applyChange receives fully_paid transition", async () => {
    const logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});

    reader.findById.mockResolvedValueOnce(mkConnection());
    customerRepo.existsByExternalId.mockResolvedValueOnce(true);
    const prior: PriorInvoiceState = { status: "open", balanceDueCents: 10_000 };
    invoiceRepo.findPriorStatesByExternalIds.mockResolvedValueOnce(
      new Map<string, PriorInvoiceState>([["inv_1", prior]]),
    );
    const inv = mkInvoice({ amountPaidCents: 10_000, balanceDueCents: 0 });
    xero.fetchInvoice.mockResolvedValueOnce(inv);
    invoiceRepo.applyChange.mockResolvedValueOnce({
      invoiceId: "inv-db-paid",
      stoppedSequenceRunIds: ["run-1"],
    });

    await useCase.execute(job);

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
        msg: "Payment detected (Xero single-invoice sync)",
        businessId: "biz-1",
        invoiceId: "inv-db-paid",
        externalId: "inv_1",
        priorBalance: 10_000,
        amountPaid: 10_000,
        stoppedSequenceRunIds: ["run-1"],
      }),
    );

    logSpy.mockRestore();
  });

  it("no payment transition: prior=paid → new=paid — applyChange gets no_change", async () => {
    reader.findById.mockResolvedValueOnce(mkConnection());
    customerRepo.existsByExternalId.mockResolvedValueOnce(true);
    const prior: PriorInvoiceState = { status: "paid", balanceDueCents: 0 };
    invoiceRepo.findPriorStatesByExternalIds.mockResolvedValueOnce(
      new Map<string, PriorInvoiceState>([["inv_1", prior]]),
    );
    const inv = mkInvoice({ amountPaidCents: 10_000, balanceDueCents: 0 });
    xero.fetchInvoice.mockResolvedValueOnce(inv);

    await useCase.execute(job);

    expect(invoiceRepo.applyChange).toHaveBeenCalledWith("biz-1", {
      externalId: inv.externalId,
      customerExternalId: inv.customerExternalId,
      invoice: inv,
      newStatus: "paid",
      transition: { kind: "no_change" },
      provider: "xero",
      lastSyncedAt: NOW,
    });
  });

  it("AuthError on fetchInvoice → refresh tokens, reload connection, retry once", async () => {
    const stale = mkConnection();
    const refreshed = mkConnection({ accessToken: "rotated" });
    reader.findById
      .mockResolvedValueOnce(stale)
      .mockResolvedValueOnce(refreshed);
    xero.fetchInvoice
      .mockRejectedValueOnce(new AuthError())
      .mockResolvedValueOnce(mkInvoice());
    customerRepo.existsByExternalId.mockResolvedValue(true);

    await useCase.execute(job);

    expect(refresh.execute).toHaveBeenCalledWith("conn-1");
    expect(xero.fetchInvoice).toHaveBeenCalledTimes(2);
    expect(invoiceRepo.applyChange).toHaveBeenCalledTimes(1);
  });

  it("AuthError twice: refreshed connection still unusable → UnrecoverableError", async () => {
    reader.findById
      .mockResolvedValueOnce(mkConnection())
      .mockResolvedValueOnce(mkConnection({ status: "expired" }));
    xero.fetchInvoice.mockRejectedValueOnce(new AuthError());

    await expect(useCase.execute(job)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(xero.fetchInvoice).toHaveBeenCalledTimes(1);
  });

  it("RateLimitError → waits retryAfterMs and retries once", async () => {
    reader.findById.mockResolvedValueOnce(mkConnection());
    customerRepo.existsByExternalId.mockResolvedValueOnce(true);
    xero.fetchInvoice
      .mockRejectedValueOnce(new RateLimitError(2_000))
      .mockResolvedValueOnce(mkInvoice());

    const promise = useCase.execute(job);
    await jest.advanceTimersByTimeAsync(2_000);
    await promise;

    expect(xero.fetchInvoice).toHaveBeenCalledTimes(2);
    expect(invoiceRepo.applyChange).toHaveBeenCalledTimes(1);
  });

  it("voided invoice (lifecycle='voided') → applyChange with newStatus voided; no special delete branch", async () => {
    reader.findById.mockResolvedValueOnce(mkConnection());
    customerRepo.existsByExternalId.mockResolvedValueOnce(true);
    const inv = mkInvoice({
      lifecycle: "voided",
      balanceDueCents: 0,
      amountPaidCents: 0,
    });
    xero.fetchInvoice.mockResolvedValueOnce(inv);

    await useCase.execute(job);

    expect(xero.fetchInvoice).toHaveBeenCalledTimes(1);
    expect(invoiceRepo.applyChange).toHaveBeenCalledWith(
      "biz-1",
      expect.objectContaining({
        newStatus: "voided",
        invoice: expect.objectContaining({ lifecycle: "voided" }),
        transition: detectInvoiceTransition(undefined, inv, NOW),
      }),
    );
  });

  it("pre-flight refresh runs when token expires within window", async () => {
    const expiringSoon = mkConnection({
      tokenExpiresAt: new Date(NOW.getTime() + 30_000),
    });
    const refreshed = mkConnection({ accessToken: "rotated" });
    reader.findById
      .mockResolvedValueOnce(expiringSoon)
      .mockResolvedValueOnce(refreshed);
    customerRepo.existsByExternalId.mockResolvedValueOnce(true);
    xero.fetchInvoice.mockResolvedValueOnce(mkInvoice());

    await useCase.execute(job);

    expect(refresh.execute).toHaveBeenCalledWith("conn-1");
    expect(xero.fetchInvoice).toHaveBeenCalledTimes(1);
  });

  it("pre-flight refresh leaves connection unusable → UnrecoverableError", async () => {
    const expiringSoon = mkConnection({
      tokenExpiresAt: new Date(NOW.getTime() + 30_000),
    });
    reader.findById
      .mockResolvedValueOnce(expiringSoon)
      .mockResolvedValueOnce(mkConnection({ status: "expired" }));

    await expect(useCase.execute(job)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(xero.fetchInvoice).not.toHaveBeenCalled();
  });
});
