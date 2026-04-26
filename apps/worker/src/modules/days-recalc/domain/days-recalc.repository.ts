export interface TransitionedInvoice {
  invoiceId: string;
  invoiceNumber: string | null;
}

export interface RecalcOutcome {
  updatedCount: number;
  transitioned: TransitionedInvoice[];
}

export interface DaysRecalcRepository {
  recalculate(): Promise<RecalcOutcome>;
  findInvoicesWithoutActiveSequenceRun(
    invoiceIds: string[],
  ): Promise<TransitionedInvoice[]>;
}

export const DAYS_RECALC_REPOSITORY = Symbol("DaysRecalcRepository");
