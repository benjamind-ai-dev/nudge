export const ENROLLMENT_REPOSITORY = Symbol("EnrollmentRepository");

export interface EnrollTarget {
  /** sequence to enroll onto; must be active & have ≥1 step */
  isActive: boolean;
  firstStepId: string;
  firstStepDelayDays: number;
}

export interface InvoiceEnrollContext {
  invoiceId: string;
  status: string;               // open | overdue | partial | paid | ...
  dueDate: Date;
  businessTimezone: string;
  activeRunId: string | null;   // an existing active/paused run, if any
}

export type EnrollOutcome =
  | "enrolled"
  | "moved"
  | "skipped_already_enrolled"
  | "skipped_not_chaseable"
  | "skipped_not_found";

export interface EnrollmentRepository {
  /** Sequence's first step + active flag, scoped to business. null if sequence not in business. */
  findEnrollTarget(sequenceId: string, businessId: string): Promise<EnrollTarget | null>;
  /** Per-invoice context (business-scoped). null if invoice not in business. */
  getInvoiceContext(invoiceId: string, businessId: string): Promise<InvoiceEnrollContext | null>;
  /** Chaseable invoice ids for a customer (open|overdue|partial), business-scoped. */
  findChaseableInvoiceIdsForCustomer(customerId: string, businessId: string): Promise<string[]>;
  /**
   * TX: enroll the invoice onto `sequenceId`.
   * - If the invoice already has an active/paused run on THIS sequence → no-op
   *   ("already_enrolled"), preserving the existing run + its progress.
   * - If it has an active/paused run on a DIFFERENT sequence → stop it as
   *   'reassigned' and create a fresh run here ("moved").
   * - Otherwise create a fresh run ("enrolled").
   */
  moveAndCreateRun(args: {
    invoiceId: string;
    businessId: string;
    sequenceId: string;
    currentStepId: string;
    nextSendAt: Date;
  }): Promise<{ outcome: "enrolled" | "moved" | "already_enrolled"; runId: string }>;
  /** Set the customer's sequence override (business-scoped). Returns false if customer not in business. */
  setCustomerSequenceOverride(customerId: string, businessId: string, sequenceId: string): Promise<boolean>;
}
