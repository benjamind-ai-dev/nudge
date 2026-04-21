import { Inject, Injectable, Logger } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";
import type {
  Connection,
  ProviderTokens,
} from "@nudge/connections-domain";
import type { CanonicalInvoice } from "../domain/canonical-invoice";
import { deriveStatus } from "../domain/canonical-invoice";
import {
  AuthError,
  INVOICE_SYNC_PROVIDERS,
  type InvoiceSyncFetchArgs,
  type InvoiceSyncPage,
  type InvoiceSyncProvider,
  type InvoiceSyncProviderMap,
  RateLimitError,
} from "../domain/invoice-sync.provider";
import {
  CUSTOMER_REPOSITORY,
  INVOICE_REPOSITORY,
  SYNC_CONNECTION_READER,
  type CustomerRepository,
  type InvoiceRepository,
  type InvoiceUpsertRow,
  type SyncConnectionReader,
} from "../domain/repositories";
import { RefreshTokenUseCase } from "../../token-refresh/application/refresh-token.use-case";

const PAGE_SIZE = 1000;
const PRE_FLIGHT_REFRESH_WINDOW_MS = 5 * 60_000;
const DEFAULT_CURSOR_LOOKBACK_MS = 365 * 24 * 60 * 60_000;
const RATE_LIMIT_PAUSE_CAP_MS = 60_000;
const TOTAL_RATE_LIMIT_BUDGET_MS = 5 * 60_000;

@Injectable()
export class SyncBusinessInvoicesUseCase {
  private readonly logger = new Logger(SyncBusinessInvoicesUseCase.name);

  constructor(
    @Inject(SYNC_CONNECTION_READER)
    private readonly reader: SyncConnectionReader,
    @Inject(INVOICE_SYNC_PROVIDERS)
    private readonly providers: InvoiceSyncProviderMap,
    @Inject(INVOICE_REPOSITORY)
    private readonly invoices: InvoiceRepository,
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customers: CustomerRepository,
    private readonly refreshTokens: RefreshTokenUseCase,
  ) {}

  async execute(businessId: string): Promise<void> {
    const initial = await this.reader.findLatestConnectedByBusiness(businessId);
    if (!initial) {
      this.logger.warn({
        msg: "No connected connection found",
        event: "invoice_sync_skipped",
        businessId,
      });
      return;
    }

    let connection = await this.preflightRefresh(initial);
    const provider = this.providers[connection.provider];
    if (!provider) {
      this.logger.warn({
        msg: "No InvoiceSyncProvider registered for provider",
        event: "invoice_sync_skipped",
        businessId,
        provider: connection.provider,
      });
      return;
    }

    const now = new Date();
    const cursor = this.resolveCursor(connection, now);
    let offset = 0;
    let lastSeenUpdatedAt = cursor;
    const touchedCustomerExtIds = new Set<string>();
    let rateLimitBudgetUsedMs = 0;

    this.logger.log({
      msg: "Invoice sync started",
      event: "invoice_sync_started",
      businessId,
      connectionId: connection.id,
      provider: connection.provider,
      cursor: cursor.toISOString(),
    });

    // Pagination loop
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { page, connectionAfter } = await this.fetchPageWithRecovery(
        provider,
        connection,
        cursor,
        offset,
        (ms) => {
          rateLimitBudgetUsedMs += ms;
          if (rateLimitBudgetUsedMs > TOTAL_RATE_LIMIT_BUDGET_MS) {
            throw new Error("Rate limit budget exceeded for this job");
          }
        },
      );
      connection = connectionAfter;

      if (page.customers.length) {
        await this.customers.upsertMany(businessId, page.customers);
      }

      if (page.invoices.length) {
        const rows = await this.buildInvoiceRows(businessId, page.invoices, now);
        await this.invoices.upsertMany(businessId, rows);
        for (const inv of page.invoices) {
          touchedCustomerExtIds.add(inv.customerExternalId);
          if (inv.lastUpdatedAt > lastSeenUpdatedAt) {
            lastSeenUpdatedAt = inv.lastUpdatedAt;
          }
        }
      }

      offset += page.invoices.length;
      if (!page.hasMore) break;
    }

    if (touchedCustomerExtIds.size) {
      await this.customers.recalculateTotalOutstanding(
        businessId,
        Array.from(touchedCustomerExtIds),
      );
    }

    if (connection.id) {
      await this.reader.updateSyncCursor(connection.id, lastSeenUpdatedAt);
    }

    this.logger.log({
      msg: "Invoice sync completed",
      event: "invoice_sync_completed",
      businessId,
      connectionId: connection.id,
      provider: connection.provider,
      cursorAdvancedTo: lastSeenUpdatedAt.toISOString(),
      customersTouched: touchedCustomerExtIds.size,
    });
  }

  // --- helpers ---

  private async preflightRefresh(conn: Connection): Promise<Connection> {
    if (!conn.id) return conn;
    const delta = conn.tokenExpiresAt.getTime() - Date.now();
    if (delta > PRE_FLIGHT_REFRESH_WINDOW_MS) return conn;

    await this.refreshTokens.execute(conn.id);
    const fresh = await this.reader.findById(conn.id);
    if (!fresh || fresh.status !== "connected") {
      throw new UnrecoverableError(
        "Pre-flight refresh left connection unusable",
      );
    }
    return fresh;
  }

  private resolveCursor(conn: Connection, now: Date): Date {
    // Connection entity does not expose syncCursor publicly; cast to access it.
    const raw = (conn as unknown as { syncCursor?: string | null }).syncCursor;
    if (raw) return new Date(raw);
    return new Date(now.getTime() - DEFAULT_CURSOR_LOOKBACK_MS);
  }

  private async fetchPageWithRecovery(
    provider: InvoiceSyncProvider,
    connection: Connection,
    cursor: Date,
    offset: number,
    onRateLimitSpend: (ms: number) => void,
  ): Promise<{ page: InvoiceSyncPage; connectionAfter: Connection }> {
    const call = (c: Connection): Promise<InvoiceSyncPage> =>
      provider.fetchPage(this.buildFetchArgs(c, cursor, offset));

    try {
      const page = await call(connection);
      return { page, connectionAfter: connection };
    } catch (err) {
      if (err instanceof AuthError) {
        if (!connection.id) throw err;
        await this.refreshTokens.execute(connection.id);
        const fresh = await this.reader.findById(connection.id);
        if (!fresh || fresh.status !== "connected") {
          throw new UnrecoverableError("Refresh failed; connection not connected");
        }
        const page = await call(fresh);
        return { page, connectionAfter: fresh };
      }
      if (err instanceof RateLimitError) {
        const wait = Math.min(err.retryAfterMs, RATE_LIMIT_PAUSE_CAP_MS);
        onRateLimitSpend(wait);
        await new Promise((r) => setTimeout(r, wait));
        const page = await call(connection);
        return { page, connectionAfter: connection };
      }
      throw err;
    }
  }

  private buildFetchArgs(
    connection: Connection,
    cursor: Date,
    offset: number,
  ): InvoiceSyncFetchArgs {
    const tokens: ProviderTokens = {
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      expiresAt: connection.tokenExpiresAt,
    };
    return {
      tokens,
      tenantId: connection.externalTenantId,
      cursor,
      offset,
      pageSize: PAGE_SIZE,
    };
  }

  private async buildInvoiceRows(
    businessId: string,
    invoices: CanonicalInvoice[],
    now: Date,
  ): Promise<InvoiceUpsertRow[]> {
    const prior = await this.invoices.findStatusesByExternalIds(
      businessId,
      invoices.map((i) => i.externalId),
    );
    return invoices.map((ci) => {
      const newStatus = deriveStatus(ci, now);
      const priorStatus = prior.get(ci.externalId);
      const isPaymentTransition =
        (priorStatus === "open" || priorStatus === "overdue") &&
        newStatus === "paid";
      if (isPaymentTransition) {
        this.logger.log({
          msg: "Payment detected",
          event: "invoice_payment_detected",
          businessId,
          externalId: ci.externalId,
          priorStatus,
          newStatus,
        });
      }
      return {
        externalId: ci.externalId,
        invoiceNumber: ci.invoiceNumber,
        customerExternalId: ci.customerExternalId,
        amountCents: ci.amountCents,
        amountPaidCents: ci.amountPaidCents,
        balanceDueCents: ci.balanceDueCents,
        currency: ci.currency,
        issuedDate: ci.issuedDate,
        dueDate: ci.dueDate,
        status: newStatus,
        paidAtIfNewlyPaid: isPaymentTransition ? now : undefined,
        lastSyncedAt: now,
      } satisfies InvoiceUpsertRow;
    });
  }
}
