import { UnrecoverableError } from "bullmq";
import type {
  Connection,
  ProviderName,
  ProviderTokens,
} from "@nudge/connections-domain";
import { SyncSingleInvoiceUseCase } from "./sync-single-invoice.use-case";
import {
  AuthError,
  RateLimitError,
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
import type { QuickbooksInvoiceSyncProvider } from "../infrastructure/quickbooks-invoice-sync.provider";
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

describe("SyncSingleInvoiceUseCase", () => {
  let qb: jest.Mocked<
    Pick<QuickbooksInvoiceSyncProvider, "fetchInvoice" | "fetchCustomerById" | "name">
  >;
  let reader: jest.Mocked<SyncConnectionReader>;
  let invoiceRepo: jest.Mocked<InvoiceRepository>;
  let customerRepo: jest.Mocked<CustomerRepository>;
  let refresh: jest.Mocked<RefreshTokenUseCaseLike>;
  let useCase: SyncSingleInvoiceUseCase;

  const job = {
    connectionId: "conn-1",
    realmId: "realm-1",
    externalInvoiceId: "inv_1",
    eventId: "evt-1",
    operation: "updated",
    occurredAt: NOW.toISOString(),
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);

    qb = {
      name: "quickbooks",
      fetchInvoice: jest.fn(),
      fetchCustomerById: jest.fn(),
    } as unknown as jest.Mocked<
      Pick<QuickbooksInvoiceSyncProvider, "fetchInvoice" | "fetchCustomerById" | "name">
    >;

    reader = {
      findAllSyncable: jest.fn(),
      findById: jest.fn(),
      updateSyncCursor: jest.fn(),
    } as unknown as jest.Mocked<SyncConnectionReader>;

    invoiceRepo = {
      findStatusesByExternalIds: jest.fn().mockResolvedValue(new Map()),
      upsertMany: jest.fn().mockResolvedValue(undefined),
      markVoidedByExternalId: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<InvoiceRepository>;

    customerRepo = {
      upsertMany: jest.fn().mockResolvedValue(undefined),
      recalculateTotalOutstanding: jest.fn().mockResolvedValue(undefined),
      existsByExternalId: jest.fn(),
    } as unknown as jest.Mocked<CustomerRepository>;

    refresh = { execute: jest.fn().mockResolvedValue(undefined) };

    useCase = new SyncSingleInvoiceUseCase(
      reader,
      qb as unknown as QuickbooksInvoiceSyncProvider,
      invoiceRepo,
      customerRepo,
      refresh as unknown as RefreshTokenUseCase,
    );
  });

  afterEach(() => jest.useRealTimers());

  it("skips with log when connection is not found", async () => {
    reader.findById.mockResolvedValueOnce(null);
    await useCase.execute(job);
    expect(qb.fetchInvoice).not.toHaveBeenCalled();
    expect(invoiceRepo.upsertMany).not.toHaveBeenCalled();
  });

  it("skips with log when connection.status is not 'connected'", async () => {
    reader.findById.mockResolvedValueOnce(
      mkConnection({ status: "expired" }),
    );
    await useCase.execute(job);
    expect(qb.fetchInvoice).not.toHaveBeenCalled();
  });

  it("skips with log when connection provider is not 'quickbooks'", async () => {
    reader.findById.mockResolvedValueOnce(
      mkConnection({ provider: "xero" as ProviderName }),
    );
    await useCase.execute(job);
    expect(qb.fetchInvoice).not.toHaveBeenCalled();
  });

  it("happy path: fetches invoice + skips customer fetch when customer exists locally + upserts", async () => {
    reader.findById.mockResolvedValueOnce(mkConnection());
    customerRepo.existsByExternalId.mockResolvedValueOnce(true);
    qb.fetchInvoice.mockResolvedValueOnce(mkInvoice());

    await useCase.execute(job);

    expect(qb.fetchInvoice).toHaveBeenCalledWith({
      tokens: expect.any(Object),
      realmId: "realm-1",
      invoiceId: "inv_1",
    });
    expect(qb.fetchCustomerById).not.toHaveBeenCalled();
    expect(customerRepo.upsertMany).not.toHaveBeenCalled();
    expect(invoiceRepo.upsertMany).toHaveBeenCalledTimes(1);
    const [businessId, rows] = invoiceRepo.upsertMany.mock.calls[0];
    expect(businessId).toBe("biz-1");
    expect(rows).toHaveLength(1);
    expect(rows[0].externalId).toBe("inv_1");
    expect(rows[0].provider).toBe("quickbooks");
    expect(customerRepo.recalculateTotalOutstanding).toHaveBeenCalledWith(
      "biz-1",
      ["C1"],
    );
  });

  it("conditional fetch: when customer is missing locally, fetches & upserts customer first", async () => {
    reader.findById.mockResolvedValueOnce(mkConnection());
    customerRepo.existsByExternalId.mockResolvedValueOnce(false);
    qb.fetchCustomerById.mockResolvedValueOnce(mkCustomer("C1"));
    qb.fetchInvoice.mockResolvedValueOnce(mkInvoice());

    await useCase.execute(job);

    expect(qb.fetchCustomerById).toHaveBeenCalledWith({
      tokens: expect.any(Object),
      realmId: "realm-1",
      customerId: "C1",
    });
    expect(customerRepo.upsertMany).toHaveBeenCalledWith(
      "biz-1",
      "quickbooks",
      [expect.objectContaining({ externalId: "C1" })],
    );
    const upsertCallOrder = customerRepo.upsertMany.mock.invocationCallOrder[0];
    const invoiceCallOrder = invoiceRepo.upsertMany.mock.invocationCallOrder[0];
    expect(upsertCallOrder).toBeLessThan(invoiceCallOrder);
  });

  it("payment-transition: prior=open, new=paid sets paidAtIfNewlyPaid=now", async () => {
    reader.findById.mockResolvedValueOnce(mkConnection());
    customerRepo.existsByExternalId.mockResolvedValueOnce(true);
    invoiceRepo.findStatusesByExternalIds.mockResolvedValueOnce(
      new Map<string, InvoiceStatus>([["inv_1", "open"]]),
    );
    qb.fetchInvoice.mockResolvedValueOnce(
      mkInvoice({ amountPaidCents: 10_000, balanceDueCents: 0 }),
    );

    await useCase.execute(job);

    const rows = invoiceRepo.upsertMany.mock.calls[0][1];
    expect(rows[0].status).toBe("paid");
    expect(rows[0].paidAtIfNewlyPaid).toEqual(NOW);
  });

  it("no payment transition: prior=paid → new=paid leaves paidAtIfNewlyPaid undefined", async () => {
    reader.findById.mockResolvedValueOnce(mkConnection());
    customerRepo.existsByExternalId.mockResolvedValueOnce(true);
    invoiceRepo.findStatusesByExternalIds.mockResolvedValueOnce(
      new Map<string, InvoiceStatus>([["inv_1", "paid"]]),
    );
    qb.fetchInvoice.mockResolvedValueOnce(
      mkInvoice({ amountPaidCents: 10_000, balanceDueCents: 0 }),
    );

    await useCase.execute(job);

    const rows = invoiceRepo.upsertMany.mock.calls[0][1];
    expect(rows[0].status).toBe("paid");
    expect(rows[0].paidAtIfNewlyPaid).toBeUndefined();
  });

  it("AuthError on fetchInvoice → refresh tokens, reload connection, retry once", async () => {
    const stale = mkConnection();
    const refreshed = mkConnection({ accessToken: "rotated" });
    reader.findById
      .mockResolvedValueOnce(stale) // initial load
      .mockResolvedValueOnce(refreshed); // post-refresh reload
    qb.fetchInvoice
      .mockRejectedValueOnce(new AuthError())
      .mockResolvedValueOnce(mkInvoice());
    customerRepo.existsByExternalId.mockResolvedValue(true);

    await useCase.execute(job);

    expect(refresh.execute).toHaveBeenCalledWith("conn-1");
    expect(qb.fetchInvoice).toHaveBeenCalledTimes(2);
    expect(invoiceRepo.upsertMany).toHaveBeenCalledTimes(1);
  });

  it("AuthError twice: refreshed connection still unusable → UnrecoverableError", async () => {
    reader.findById
      .mockResolvedValueOnce(mkConnection())
      .mockResolvedValueOnce(mkConnection({ status: "expired" }));
    qb.fetchInvoice.mockRejectedValueOnce(new AuthError());

    await expect(useCase.execute(job)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(qb.fetchInvoice).toHaveBeenCalledTimes(1);
  });

  it("RateLimitError → waits retryAfterMs and retries once", async () => {
    reader.findById.mockResolvedValueOnce(mkConnection());
    customerRepo.existsByExternalId.mockResolvedValueOnce(true);
    qb.fetchInvoice
      .mockRejectedValueOnce(new RateLimitError(2_000))
      .mockResolvedValueOnce(mkInvoice());

    const promise = useCase.execute(job);
    await jest.advanceTimersByTimeAsync(2_000);
    await promise;

    expect(qb.fetchInvoice).toHaveBeenCalledTimes(2);
    expect(invoiceRepo.upsertMany).toHaveBeenCalledTimes(1);
  });

  describe("operation === 'deleted'", () => {
    const deletedJob = { ...job, operation: "deleted" };

    it("soft-voids the local invoice and recalcs customer outstanding", async () => {
      reader.findById.mockResolvedValueOnce(mkConnection());
      invoiceRepo.markVoidedByExternalId.mockResolvedValueOnce({
        customerExternalId: "C1",
      });

      await useCase.execute(deletedJob);

      expect(invoiceRepo.markVoidedByExternalId).toHaveBeenCalledWith(
        "biz-1",
        "inv_1",
      );
      expect(qb.fetchInvoice).not.toHaveBeenCalled();
      expect(qb.fetchCustomerById).not.toHaveBeenCalled();
      expect(invoiceRepo.upsertMany).not.toHaveBeenCalled();
      expect(customerRepo.recalculateTotalOutstanding).toHaveBeenCalledWith(
        "biz-1",
        ["C1"],
      );
    });

    it("no-ops when the invoice was never persisted locally", async () => {
      reader.findById.mockResolvedValueOnce(mkConnection());
      invoiceRepo.markVoidedByExternalId.mockResolvedValueOnce(null);

      await useCase.execute(deletedJob);

      expect(qb.fetchInvoice).not.toHaveBeenCalled();
      expect(invoiceRepo.upsertMany).not.toHaveBeenCalled();
      expect(customerRepo.recalculateTotalOutstanding).not.toHaveBeenCalled();
    });

    it("still respects connection gating (skipped when not 'connected')", async () => {
      reader.findById.mockResolvedValueOnce(
        mkConnection({ status: "expired" }),
      );

      await useCase.execute(deletedJob);

      expect(invoiceRepo.markVoidedByExternalId).not.toHaveBeenCalled();
    });
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
    qb.fetchInvoice.mockResolvedValueOnce(mkInvoice());

    await useCase.execute(job);

    expect(refresh.execute).toHaveBeenCalledWith("conn-1");
    expect(qb.fetchInvoice).toHaveBeenCalledTimes(1);
  });
});
