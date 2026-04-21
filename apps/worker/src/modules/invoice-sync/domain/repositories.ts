import type { Connection, ProviderName } from "@nudge/connections-domain";
import type { CanonicalCustomer, InvoiceStatus } from "./canonical-invoice";

export const INVOICE_REPOSITORY = Symbol("INVOICE_REPOSITORY");
export const CUSTOMER_REPOSITORY = Symbol("CUSTOMER_REPOSITORY");
export const SYNC_CONNECTION_READER = Symbol("SYNC_CONNECTION_READER");

export interface InvoiceUpsertRow {
  externalId: string;
  invoiceNumber: string | null;
  customerExternalId: string;
  amountCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  currency: string;
  paymentLinkUrl: string | null;
  issuedDate: Date | null;
  dueDate: Date;
  status: InvoiceStatus;
  provider: ProviderName;
  /** Set to `now` only on open/overdue → paid transitions; otherwise undefined. */
  paidAtIfNewlyPaid: Date | undefined;
  lastSyncedAt: Date;
}

export interface InvoiceRepository {
  /** Returns map of externalId → prior status, for invoices that already exist. */
  findStatusesByExternalIds(
    businessId: string,
    externalIds: string[],
  ): Promise<Map<string, InvoiceStatus>>;

  /**
   * Upsert invoices by (business_id, external_id). Resolves customer FK by
   * looking up customers.external_id — customers must be upserted first.
   */
  upsertMany(businessId: string, rows: InvoiceUpsertRow[]): Promise<void>;
}

export interface CustomerRepository {
  upsertMany(
    businessId: string,
    provider: ProviderName,
    customers: CanonicalCustomer[],
  ): Promise<void>;

  /**
   * Recomputes `customers.total_outstanding` as the sum of balance_due_cents
   * of open/overdue/partial invoices, for the given customer external IDs.
   */
  recalculateTotalOutstanding(
    businessId: string,
    customerExternalIds: string[],
  ): Promise<void>;
}

export interface SyncConnectionReader {
  /** All connections with status='connected' whose provider is in the allow-list. */
  findAllSyncable(providerNames: readonly ProviderName[]): Promise<Connection[]>;

  /** Look up a connection by id (used after refresh to get rotated tokens). */
  findById(id: string): Promise<Connection | null>;

  /** Persist the advanced sync cursor on connections.sync_cursor. */
  updateSyncCursor(id: string, cursor: Date): Promise<void>;
}
