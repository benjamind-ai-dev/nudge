export interface OverdueInvoiceRow {
  invoiceId: string;
  invoiceNumber: string | null;
  customerId: string;
  customerSequenceId: string | null;
  customerTierId: string | null;
  customerTierSequenceId: string | null;
  dueDate: Date;
  businessId: string;
  businessTimezone: string;
}

export interface SequenceFirstStep {
  firstStepId: string;
  firstStepDelayDays: number;
}

export interface SequenceTriggerRepository {
  findOverdueInvoicesWithoutRun(limit: number, offset: number): Promise<OverdueInvoiceRow[]>;
  findDefaultTierSequenceId(businessId: string): Promise<string | null>;
  findSequenceFirstStep(sequenceId: string): Promise<SequenceFirstStep | null>;
  createSequenceRun(data: {
    invoiceId: string;
    sequenceId: string;
    currentStepId: string;
    status: "active";
    nextSendAt: Date;
    startedAt: Date;
  }): Promise<{ created: boolean; runId: string | null }>;
}

export const SEQUENCE_TRIGGER_REPOSITORY = Symbol("SequenceTriggerRepository");
