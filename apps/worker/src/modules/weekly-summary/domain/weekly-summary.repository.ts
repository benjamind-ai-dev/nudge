import type { WeeklySummary } from "./weekly-summary.entity";

export const WEEKLY_SUMMARY_REPOSITORY = Symbol("WEEKLY_SUMMARY_REPOSITORY");

export interface WeeklySummaryRepository {
  /** Inserts a fresh pending row. Throws if (businessId, weekStartsAt) already exists. */
  insertPending(input: {
    businessId: string;
    weekStartsAt: string;
  }): Promise<WeeklySummary>;

  exists(businessId: string, weekStartsAt: string): Promise<boolean>;

  save(summary: WeeklySummary): Promise<void>;
}
