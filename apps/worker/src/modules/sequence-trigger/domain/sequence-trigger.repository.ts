export interface OverdueInvoiceRow {
  invoiceId: string;
  invoiceNumber: string | null;
  customerId: string;
  customerTierId: string | null;
  dueDate: Date;
  businessId: string;
  businessTimezone: string;
}

export interface TierWithSequence {
  tierId: string;
  tierName: string;
  sequenceId: string;
  firstStepId: string;
  firstStepDelayDays: number;
}

export interface SequenceTriggerRepository {
  findOverdueInvoicesWithoutRun(limit: number, offset: number): Promise<OverdueInvoiceRow[]>;
  findDefaultTier(businessId: string): Promise<{ id: string; name: string } | null>;
  findActiveSequenceForTier(tierId: string, businessId: string): Promise<TierWithSequence | null>;
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
