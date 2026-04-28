import type { Connection, ProviderName } from "@nudge/connections-domain";
import type { StoppedReason } from "@nudge/shared";
import type { PrismaTransactionClient } from "../../../common/database/prisma-tx";
import type {
  CanonicalCustomer,
  CanonicalInvoice,
  InvoiceStatus,
  InvoiceTransition,
} from "./canonical-invoice";

export const INVOICE_REPOSITORY = Symbol("INVOICE_REPOSITORY");
export const CUSTOMER_REPOSITORY = Symbol("CUSTOMER_REPOSITORY");
export const SYNC_CONNECTION_READER = Symbol("SYNC_CONNECTION_READER");
export const SEQUENCE_RUN_REPOSITORY = Symbol("SEQUENCE_RUN_REPOSITORY");

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

/**
 * One invoice change to apply atomically. Built by the sync use cases from
 * the (priorState, canonicalInvoice, now) triple via detectInvoiceTransition.
 *
 * Used by `InvoiceRepository.applyChange` (added in Task 6).
 */
export interface InvoiceChange {
  externalId: string;
  customerExternalId: string;
  invoice: CanonicalInvoice;
  newStatus: InvoiceStatus;
  transition: InvoiceTransition;
  provider: ProviderName;
  lastSyncedAt: Date;
}

export interface ApplyChangeResult {
  invoiceId: string;
  /** Empty when no active/paused run was stopped. */
  stoppedSequenceRunIds: string[];
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

  /**
   * Soft-void an invoice that was hard-deleted in the provider. Sets status
   * to "voided" so downstream sequence-trigger logic stops dunning. Returns
   * the customer's external id (so the caller can recalc total_outstanding),
   * or null when the invoice was never persisted locally.
   */
  markVoidedByExternalId(
    businessId: string,
    externalId: string,
  ): Promise<{ customerExternalId: string } | null>;
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

  /** True when a customer with `external_id` is already persisted for this business. */
  existsByExternalId(businessId: string, externalId: string): Promise<boolean>;
}

export interface SequenceRunRepository {
  /**
   * Stop every active|paused sequence_run for an invoice. Runs INSIDE the
   * caller-provided transaction so the stop is atomic with the invoice update.
   * Returns the IDs of stopped runs (empty array when none).
   */
  stopActiveRunsForInvoice(
    tx: PrismaTransactionClient,
    invoiceId: string,
    reason: StoppedReason,
    completedAt: Date,
  ): Promise<string[]>;
}

export interface SyncConnectionReader {
  /** All connections with status='connected' whose provider is in the allow-list. */
  findAllSyncable(providerNames: readonly ProviderName[]): Promise<Connection[]>;

  /** Look up a connection by id (used after refresh to get rotated tokens). */
  findById(id: string): Promise<Connection | null>;

  /** Persist the advanced sync cursor on connections.sync_cursor. */
  updateSyncCursor(id: string, cursor: Date): Promise<void>;
}
