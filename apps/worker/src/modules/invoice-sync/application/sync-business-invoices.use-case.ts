import { Inject, Injectable, Logger } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";
import type { Connection, ProviderTokens } from "@nudge/connections-domain";
import { deriveStatus, detectInvoiceTransition } from "../domain/canonical-invoice";
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
  type SyncConnectionReader,
} from "../domain/repositories";
import { RefreshTokenUseCase } from "../../token-refresh/application/refresh-token.use-case";

const PAGE_SIZE = 1000;
const PRE_FLIGHT_REFRESH_WINDOW_MS = 5 * 60_000;
// Pull 90 days (3 months) of history on first sync (null cursor). Once the
// cursor is set, subsequent syncs only pull the delta regardless of this value.
const DEFAULT_CURSOR_LOOKBACK_MS = 90 * 24 * 60 * 60_000;
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

  async execute(connectionId: string): Promise<void> {
    const initial = await this.reader.findById(connectionId);
    if (!initial || initial.status !== "connected") {
      this.logger.warn({
        msg: "Connection not found or not connected — skipping sync",
        event: "invoice_sync_skipped",
        connectionId,
        status: initial?.status ?? "not_found",
      });
      return;
    }

    const businessId = initial.businessId;
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

    try {
      while (true) {
        const { page, connectionAfter } = await this.fetchPageWithRecovery(
          provider,
          connection,
          cursor,
          offset,
          (ms) => {
            rateLimitBudgetUsedMs += ms;
            if (rateLimitBudgetUsedMs > TOTAL_RATE_LIMIT_BUDGET_MS) {
              this.logger.warn({
                msg: "Rate limit budget exhausted — bailing to let BullMQ retry",
                event: "invoice_sync_rate_limit_budget_exhausted",
                businessId,
                connectionId: connection.id,
                rateLimitBudgetUsedMs,
              });
              throw new Error("Rate limit budget exceeded for this job");
            }
          },
        );
        connection = connectionAfter;

        if (page.customers.length) {
          await this.customers.upsertMany(businessId, provider.name, page.customers);
        }

        if (page.invoices.length) {
          const externalIds = page.invoices.map((i) => i.externalId);
          const priorByExt = await this.invoices.findPriorStatesByExternalIds(
            businessId,
            externalIds,
          );

          for (const ci of page.invoices) {
            const prior = priorByExt.get(ci.externalId);
            const transition = detectInvoiceTransition(prior, ci, now);
            const newStatus = deriveStatus(ci, now);

            const result = await this.invoices.applyChange(businessId, {
              externalId: ci.externalId,
              customerExternalId: ci.customerExternalId,
              invoice: ci,
              newStatus,
              transition,
              provider: provider.name,
              lastSyncedAt: now,
            });

            if (transition.kind === "fully_paid") {
              this.logger.log({
                msg: "Payment detected",
                event: "invoice_payment_detected",
                businessId,
                externalId: ci.externalId,
                invoiceNumber: ci.invoiceNumber,
                priorBalance: transition.priorBalance,
                amountPaid: ci.amountPaidCents,
                stoppedSequenceRunIds: result.stoppedSequenceRunIds,
              });
            } else if (transition.kind === "voided") {
              this.logger.log({
                msg: "Invoice voided",
                event: "invoice_voided",
                businessId,
                externalId: ci.externalId,
                invoiceNumber: ci.invoiceNumber,
                priorStatus: transition.priorStatus,
                priorBalance: transition.priorBalance,
                stoppedSequenceRunIds: result.stoppedSequenceRunIds,
              });
            }

            touchedCustomerExtIds.add(ci.customerExternalId);
            if (ci.lastUpdatedAt > lastSeenUpdatedAt) {
              lastSeenUpdatedAt = ci.lastUpdatedAt;
            }
          }
        }

        offset += page.invoices.length;
        if (!page.hasMore) break;
        if (page.invoices.length === 0) {
          // Provider signalled hasMore but returned no records — treat as terminal
          // to avoid an infinite loop. QB can emit this for sparse page windows.
          this.logger.warn({
            msg: "Provider returned empty page with hasMore=true; treating as terminal",
            event: "invoice_sync_empty_hasmore",
            businessId,
            offset,
          });
          break;
        }
      }
    } finally {
      // Advance the cursor even on partial failure so already-committed pages
      // aren't reprocessed next tick. Customer total_outstanding is now
      // maintained atomically per invoice in `applyChange`; the periodic
      // reconciliation tick (days-recalc) catches any drift.
      if (connection.id && lastSeenUpdatedAt > cursor) {
        await this.reader.updateSyncCursor(connection.id, lastSeenUpdatedAt);
      }
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

}
