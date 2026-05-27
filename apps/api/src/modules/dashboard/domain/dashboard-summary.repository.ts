import type { AgingBuckets, Outstanding } from "./dashboard-summary.entity";

export const DASHBOARD_SUMMARY_REPOSITORY = Symbol("DASHBOARD_SUMMARY_REPOSITORY");

export interface DashboardSummaryRepository {
  /** Returns null when the business does not exist. */
  getBusinessTimezone(businessId: string): Promise<string | null>;

  /** Outstanding = balance + count for status IN ('open','overdue','partial'). */
  getOutstanding(businessId: string): Promise<Outstanding>;

  /**
   * Sum of amount_paid_cents for invoices whose paid_at falls inside the
   * calendar month identified by `monthsAgo` (0 = current, 1 = previous),
   * with month boundaries evaluated in the supplied IANA timezone.
   */
  getRecoveredForMonth(
    businessId: string,
    timezone: string,
    monthsAgo: 0 | 1,
  ): Promise<{ totalCents: number }>;

  /**
   * Average of (paid_at::date - due_date) in whole days, rounded to nearest
   * integer, for invoices paid in [startInclusive, endExclusive). Returns 0
   * when no invoices match.
   */
  getAvgDaysToPayBetween(
    businessId: string,
    startInclusive: Date,
    endExclusive: Date,
  ): Promise<number>;

  /** Count distinct sequence_runs with status = 'active' for the business. */
  countActiveSequences(businessId: string): Promise<number>;

  /** Aging buckets for status IN ('open','overdue','partial'). */
  getAgingBuckets(businessId: string): Promise<AgingBuckets>;
}
