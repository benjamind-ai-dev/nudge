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

export type EnrollOutcome = "enrolled" | "moved" | "skipped_not_chaseable" | "skipped_not_found";

export interface EnrollmentRepository {
  /** Sequence's first step + active flag, scoped to business. null if sequence not in business. */
  findEnrollTarget(sequenceId: string, businessId: string): Promise<EnrollTarget | null>;
  /** Per-invoice context (business-scoped). null if invoice not in business. */
  getInvoiceContext(invoiceId: string, businessId: string): Promise<InvoiceEnrollContext | null>;
  /** Chaseable invoice ids for a customer (open|overdue|partial), business-scoped. */
  findChaseableInvoiceIdsForCustomer(customerId: string, businessId: string): Promise<string[]>;
  /** TX: stop the invoice's active/paused run (if any) as 'reassigned', then create a fresh run on `sequenceId`. Returns whether an old run was moved. */
  moveAndCreateRun(args: {
    invoiceId: string;
    businessId: string;
    sequenceId: string;
    currentStepId: string;
    nextSendAt: Date;
  }): Promise<{ moved: boolean; runId: string }>;
  /** Set the customer's sequence override (business-scoped). Returns false if customer not in business. */
  setCustomerSequenceOverride(customerId: string, businessId: string, sequenceId: string): Promise<boolean>;
}
