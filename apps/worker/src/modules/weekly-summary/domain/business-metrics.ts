/**
 * NOTE: These interfaces contain customer names (PII).
 * Before passing BusinessMetrics to the Claude API, caller must anonymize
 * all customerName fields (replace with anonymized identifiers).
 */
export interface OverdueCustomerSummary {
  customerId: string;
  customerName: string;
  totalOutstandingCents: number;
  oldestInvoiceDaysOverdue: number;
}

export interface FlaggedRunSummary {
  runId: string;
  customerId: string;
  customerName: string;
  invoiceAmountCents: number;
}

export interface OverdueInvoiceRow {
  customerName: string;
  amountCents: number;
  daysOverdue: number;
  currentSequenceStep: number | null;
}

export interface BusinessMetrics {
  weekStartsAt: string;
  recoveredThisWeekCents: number;
  recoveredPriorWeekCents: number;
  invoicesCollectedCount: number;
  avgDaysToPayThisWeek: number | null;
  avgDaysToPayTrailing4Weeks: number | null;
  currentlyOverdueCount: number;
  topOverdueCustomers: OverdueCustomerSummary[];
  flaggedRuns: FlaggedRunSummary[];
  activeSequencesCount: number;
  top5OverdueInvoices: OverdueInvoiceRow[];
}

export function isMetricsEmpty(m: BusinessMetrics): boolean {
  return (
    m.recoveredThisWeekCents === 0 &&
    m.currentlyOverdueCount === 0 &&
    m.activeSequencesCount === 0 &&
    m.flaggedRuns.length === 0
  );
}
