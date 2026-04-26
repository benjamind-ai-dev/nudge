import { Inject, Injectable, Logger } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";
import type {
  Connection,
  ProviderTokens,
} from "@nudge/connections-domain";
import type { QuickbooksWebhooksJobData } from "@nudge/shared";
import {
  AuthError,
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
import { deriveStatus, type CanonicalInvoice } from "../domain/canonical-invoice";
import { QuickbooksInvoiceSyncProvider } from "../infrastructure/quickbooks-invoice-sync.provider";
import { RefreshTokenUseCase } from "../../token-refresh/application/refresh-token.use-case";

const PRE_FLIGHT_REFRESH_WINDOW_MS = 5 * 60_000;
const RATE_LIMIT_PAUSE_CAP_MS = 60_000;

@Injectable()
export class SyncSingleInvoiceUseCase {
  private readonly logger = new Logger(SyncSingleInvoiceUseCase.name);

  constructor(
    @Inject(SYNC_CONNECTION_READER)
    private readonly reader: SyncConnectionReader,
    private readonly qb: QuickbooksInvoiceSyncProvider,
    @Inject(INVOICE_REPOSITORY)
    private readonly invoices: InvoiceRepository,
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customers: CustomerRepository,
    private readonly refreshTokens: RefreshTokenUseCase,
  ) {}

  async execute(job: QuickbooksWebhooksJobData): Promise<void> {
    const initial = await this.reader.findById(job.connectionId);
    if (!initial) {
      this.logger.warn({
        msg: "Connection not found — skipping single-invoice sync",
        event: "qb_single_invoice_skipped",
        reason: "connection_not_found",
        connectionId: job.connectionId,
        eventId: job.eventId,
      });
      return;
    }
    if (initial.status !== "connected") {
      this.logger.warn({
        msg: "Connection not 'connected' — skipping single-invoice sync",
        event: "qb_single_invoice_skipped",
        reason: "connection_not_connected",
        connectionId: job.connectionId,
        status: initial.status,
        eventId: job.eventId,
      });
      return;
    }
    if (initial.provider !== "quickbooks") {
      this.logger.warn({
        msg: "Connection provider is not quickbooks — skipping",
        event: "qb_single_invoice_skipped",
        reason: "wrong_provider",
        connectionId: job.connectionId,
        provider: initial.provider,
        eventId: job.eventId,
      });
      return;
    }

    const businessId = initial.businessId;
    const connection = await this.preflightRefresh(initial);
    const now = new Date();

    this.logger.log({
      msg: "QB single-invoice sync started",
      event: "qb_single_invoice_started",
      businessId,
      connectionId: connection.id,
      realmId: job.realmId,
      externalInvoiceId: job.externalInvoiceId,
      eventId: job.eventId,
      operation: job.operation,
    });

    const { invoice, connectionAfter } = await this.fetchInvoiceWithRecovery(
      connection,
      job,
    );

    const customerExtId = invoice.customerExternalId;
    const customerExists = await this.customers.existsByExternalId(
      businessId,
      customerExtId,
    );

    if (!customerExists) {
      this.logger.log({
        msg: "Customer missing locally — fetching from QuickBooks",
        event: "qb_single_invoice_customer_fetch",
        businessId,
        customerExternalId: customerExtId,
        eventId: job.eventId,
      });
      const customer = await this.qb.fetchCustomerById({
        tokens: this.tokensOf(connectionAfter),
        realmId: job.realmId,
        customerId: customerExtId,
      });
      await this.customers.upsertMany(businessId, "quickbooks", [customer]);
    }

    const row = await this.buildInvoiceRow(businessId, invoice, now);
    await this.invoices.upsertMany(businessId, [row]);

    await this.customers.recalculateTotalOutstanding(businessId, [customerExtId]);

    this.logger.log({
      msg: "QB single-invoice sync completed",
      event: "qb_single_invoice_completed",
      businessId,
      connectionId: connection.id,
      externalInvoiceId: invoice.externalId,
      status: row.status,
      paymentTransition: row.paidAtIfNewlyPaid !== undefined,
      eventId: job.eventId,
    });
  }

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

  private async fetchInvoiceWithRecovery(
    connection: Connection,
    job: QuickbooksWebhooksJobData,
  ): Promise<{ invoice: CanonicalInvoice; connectionAfter: Connection }> {
    const call = (c: Connection): Promise<CanonicalInvoice> =>
      this.qb.fetchInvoice({
        tokens: this.tokensOf(c),
        realmId: job.realmId,
        invoiceId: job.externalInvoiceId,
      });

    try {
      const invoice = await call(connection);
      return { invoice, connectionAfter: connection };
    } catch (err) {
      if (err instanceof AuthError) {
        if (!connection.id) throw err;
        await this.refreshTokens.execute(connection.id);
        const fresh = await this.reader.findById(connection.id);
        if (!fresh || fresh.status !== "connected") {
          throw new UnrecoverableError(
            "Refresh failed; connection not connected",
          );
        }
        const invoice = await call(fresh);
        return { invoice, connectionAfter: fresh };
      }
      if (err instanceof RateLimitError) {
        const wait = Math.min(err.retryAfterMs, RATE_LIMIT_PAUSE_CAP_MS);
        await new Promise((r) => setTimeout(r, wait));
        const invoice = await call(connection);
        return { invoice, connectionAfter: connection };
      }
      throw err;
    }
  }

  private tokensOf(connection: Connection): ProviderTokens {
    return {
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      expiresAt: connection.tokenExpiresAt,
    };
  }

  private async buildInvoiceRow(
    businessId: string,
    invoice: CanonicalInvoice,
    now: Date,
  ): Promise<InvoiceUpsertRow> {
    const prior = await this.invoices.findStatusesByExternalIds(businessId, [
      invoice.externalId,
    ]);
    const newStatus = deriveStatus(invoice, now);
    const priorStatus = prior.get(invoice.externalId);
    const isPaymentTransition =
      (priorStatus === "open" || priorStatus === "overdue") &&
      newStatus === "paid";

    if (isPaymentTransition) {
      this.logger.log({
        msg: "Payment detected (single-invoice sync)",
        event: "invoice_payment_detected",
        businessId,
        externalId: invoice.externalId,
        priorStatus,
        newStatus,
      });
    }

    return {
      externalId: invoice.externalId,
      invoiceNumber: invoice.invoiceNumber,
      customerExternalId: invoice.customerExternalId,
      amountCents: invoice.amountCents,
      amountPaidCents: invoice.amountPaidCents,
      balanceDueCents: invoice.balanceDueCents,
      currency: invoice.currency,
      paymentLinkUrl: invoice.paymentLinkUrl,
      issuedDate: invoice.issuedDate,
      dueDate: invoice.dueDate,
      status: newStatus,
      provider: "quickbooks",
      paidAtIfNewlyPaid: isPaymentTransition ? now : undefined,
      lastSyncedAt: now,
    };
  }
}
