import { Inject, Injectable } from "@nestjs/common";
import { BusinessNotFoundError } from "../../business/domain/business.errors";
import {
  DASHBOARD_SUMMARY_REPOSITORY,
  type DashboardSummaryRepository,
} from "../domain/dashboard-summary.repository";
import type { DashboardSummary } from "../domain/dashboard-summary.entity";

const MS_PER_DAY = 86_400_000;

@Injectable()
export class GetDashboardSummaryUseCase {
  constructor(
    @Inject(DASHBOARD_SUMMARY_REPOSITORY)
    private readonly repo: DashboardSummaryRepository,
  ) {}

  async execute(businessId: string): Promise<DashboardSummary> {
    const timezone = await this.repo.getBusinessTimezone(businessId);
    if (!timezone) {
      throw new BusinessNotFoundError(businessId);
    }

    const now = new Date();
    const last30Start = new Date(now.getTime() - 30 * MS_PER_DAY);
    const prev30Start = new Date(now.getTime() - 60 * MS_PER_DAY);

    const [
      outstanding,
      recoveredCurrent,
      recoveredPrior,
      avgCurrent,
      avgPrevious,
      activeSequencesCount,
      aging,
    ] = await Promise.all([
      this.repo.getOutstanding(businessId),
      this.repo.getRecoveredForMonth(businessId, timezone, 0),
      this.repo.getRecoveredForMonth(businessId, timezone, 1),
      this.repo.getAvgDaysToPayBetween(businessId, last30Start, now),
      this.repo.getAvgDaysToPayBetween(businessId, prev30Start, last30Start),
      this.repo.countActiveSequences(businessId),
      this.repo.getAgingBuckets(businessId),
    ]);

    const pctChangeVsLastMonth =
      recoveredPrior.totalCents === 0
        ? 0
        : ((recoveredCurrent.totalCents - recoveredPrior.totalCents) /
            recoveredPrior.totalCents) *
          100;

    return {
      outstanding,
      recoveredThisMonth: {
        totalCents: recoveredCurrent.totalCents,
        pctChangeVsLastMonth,
      },
      avgDaysToPay: {
        currentDays: avgCurrent,
        previousDays: avgPrevious,
      },
      activeSequences: { count: activeSequencesCount },
      aging,
    };
  }
}
