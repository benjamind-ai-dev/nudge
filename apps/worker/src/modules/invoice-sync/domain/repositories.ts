import type { Connection, ProviderName } from "@nudge/connections-domain";
import type { StoppedReason } from "@nudge/shared";
import type { PrismaTransactionClient } from "../../../common/database/prisma-tx";
import type {
  CanonicalCustomer,
  CanonicalInvoice,
  InvoiceStatus,
  InvoiceTransition,
  PriorInvoiceState,
} from "./canonical-invoice";

export const INVOICE_REPOSITORY = Symbol("INVOICE_REPOSITORY");
export const CUSTOMER_REPOSITORY = Symbol("CUSTOMER_REPOSITORY");
export const SYNC_CONNECTION_READER = Symbol("SYNC_CONNECTION_READER");
export const SEQUENCE_RUN_REPOSITORY = Symbol("SEQUENCE_RUN_REPOSITORY");

/**
 * One invoice change to apply atomically. Built by the sync use cases from
 * the (priorState, canonicalInvoice, now) triple via detectInvoiceTransition.
 *
 * Used by `InvoiceRepository.applyChange`.
 */
export interface InvoiceChange {
  externalId: string;
  customerExternalId: string;
  invoice: CanonicalInvoice;
  /** MUST equal `deriveStatus(invoice, lastSyncedAt)`; pre-computed by the caller to avoid re-deriving in the repository. */
  newStatus: InvoiceStatus;
  transition: InvoiceTransition;
  provider: ProviderName;
  lastSyncedAt: Date;
}

/** Result of `InvoiceRepository.applyChange`. */
export interface ApplyChangeResult {
  invoiceId: string;
  /** Empty when no active/paused run was stopped. */
  stoppedSequenceRunIds: string[];
}

/**
 * Local-only fields needed to synthesize a CanonicalInvoice when the provider
 * sends a deletion event without a payload (e.g., QuickBooks Deleted webhook).
 * Populated from the persisted row by `InvoiceRepository.findLocalSnapshotForVoid`.
 */
export interface LocalInvoiceSnapshot {
  invoiceNumber: string | null;
  customerExternalId: string;
  amountCents: number;
  amountPaidCents: number;
  currency: string;
  paymentLinkUrl: string | null;
  issuedDate: Date | null;
  dueDate: Date;
}

export interface InvoiceRepository {
  /**
   * Returns map of externalId → { status, balanceDueCents } for invoices that
   * already exist for this business. Missing externalIds are absent from the
   * map. Used by the sync use cases to feed `detectInvoiceTransition`.
   */
  findPriorStatesByExternalIds(
    businessId: string,
    externalIds: string[],
  ): Promise<Map<string, PriorInvoiceState>>;

  /**
   * Apply one invoice change atomically. Wraps everything in a single Prisma
   * transaction so the invoice update, the sequence-run stop, and the
   * customer.total_outstanding adjustment commit together.
   *
   * Dispatches by `change.transition.kind`:
   *  - `no_change`        — bumps `last_synced_at` only.
   *  - `new_invoice`      — inserts; if the new row is open/overdue/partial,
   *                          increments customer.total_outstanding by its
   *                          balance.
   *  - `balance_changed`  — updates fields; adjusts customer balance by
   *                          (newBalance − priorBalance).
   *  - `partial_payment`  — updates fields; adjusts customer balance by
   *                          (newBalance − priorBalance).
   *  - `fully_paid`       — sets status='paid', stamps paid_at, zeros
   *                          balance, stops active|paused sequence_runs with
   *                          reason='payment_received', decrements customer
   *                          balance by priorBalance.
   *  - `voided`           — sets status='voided', stops active|paused
   *                          sequence_runs with reason='invoice_voided',
   *                          decrements customer balance by priorBalance.
   *
   * Always returns `ApplyChangeResult` with the local invoice id and the IDs
   * of any sequence runs that were stopped (empty when none).
   */
  applyChange(
    businessId: string,
    change: InvoiceChange,
  ): Promise<ApplyChangeResult>;

  /**
   * Reads the persisted invoice's local fields needed to synthesize a
   * CanonicalInvoice for a void-only flow (e.g., QuickBooks Deleted webhook
   * where the provider doesn't include the invoice payload). Returns null
   * when the invoice was never persisted locally.
   */
  findLocalSnapshotForVoid(
    businessId: string,
    externalId: string,
  ): Promise<LocalInvoiceSnapshot | null>;
}

export interface CustomerRepository {
  upsertMany(
    businessId: string,
    provider: ProviderName,
    customers: CanonicalCustomer[],
  ): Promise<void>;

  /**
   * Recompute `customers.total_outstanding` for **every** customer in the
   * database in a single bulk SQL UPDATE. Used by the periodic days-recalc
   * tick as a drift-safety net for the per-invoice atomic balance updates
   * done by `InvoiceRepository.applyChange`.
   *
   * Returns the count of customer rows whose `total_outstanding` actually
   * changed (rows where the recomputed sum differed from the stored value).
   * The bulk update uses `IS DISTINCT FROM` to skip no-op writes.
   */
  reconcileAllTotalOutstanding(): Promise<{ updatedCount: number }>;

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
