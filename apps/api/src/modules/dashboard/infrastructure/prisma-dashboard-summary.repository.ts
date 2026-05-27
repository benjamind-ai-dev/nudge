import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  AgingBuckets,
  Outstanding,
} from "../domain/dashboard-summary.entity";
import type { DashboardSummaryRepository } from "../domain/dashboard-summary.repository";

const OPEN_STATUSES = ["open", "overdue", "partial"] as const;

interface AgingRow {
  current_count: bigint;
  current_total: bigint;
  d1_30_count: bigint;
  d1_30_total: bigint;
  d31_60_count: bigint;
  d31_60_total: bigint;
  d61_90_count: bigint;
  d61_90_total: bigint;
  d90plus_count: bigint;
  d90plus_total: bigint;
}

interface RecoveredRow {
  total_cents: bigint;
}

interface AvgRow {
  avg_days: number | null;
}

@Injectable()
export class PrismaDashboardSummaryRepository implements DashboardSummaryRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async getBusinessTimezone(businessId: string): Promise<string | null> {
    const row = await this.prisma.business.findFirst({
      where: { id: businessId },
      select: { timezone: true },
    });
    return row?.timezone ?? null;
  }

  async getOutstanding(businessId: string): Promise<Outstanding> {
    const result = await this.prisma.invoice.aggregate({
      where: {
        businessId,
        status: { in: [...OPEN_STATUSES] },
      },
      _sum: { balanceDueCents: true },
      _count: { _all: true },
    });
    return {
      totalCents: result._sum.balanceDueCents ?? 0,
      count: result._count._all,
    };
  }

  async getRecoveredForMonth(
    businessId: string,
    timezone: string,
    monthsAgo: 0 | 1,
  ): Promise<{ totalCents: number }> {
    // Month boundary computed in the business timezone, then converted back to
    // an absolute UTC instant for the WHERE comparison against `paid_at` (timestamptz).
    // monthsAgo = 0 → [start_of_this_month, start_of_next_month)
    // monthsAgo = 1 → [start_of_last_month, start_of_this_month)
    const rows = await this.prisma.$queryRaw<RecoveredRow[]>`
      WITH bounds AS (
        SELECT
          (date_trunc('month', timezone(${timezone}::text, now()))
            - (${monthsAgo} || ' months')::interval) AT TIME ZONE ${timezone}::text AS lo,
          (date_trunc('month', timezone(${timezone}::text, now()))
            - ((${monthsAgo} - 1) || ' months')::interval) AT TIME ZONE ${timezone}::text AS hi
      )
      SELECT COALESCE(SUM(amount_paid_cents), 0)::bigint AS total_cents
      FROM invoices, bounds
      WHERE business_id = ${businessId}::uuid
        AND paid_at IS NOT NULL
        AND paid_at >= bounds.lo
        AND paid_at <  bounds.hi
    `;
    return { totalCents: Number(rows[0]?.total_cents ?? 0n) };
  }

  async getAvgDaysToPayBetween(
    businessId: string,
    startInclusive: Date,
    endExclusive: Date,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<AvgRow[]>`
      SELECT ROUND(AVG(paid_at::date - due_date))::int AS avg_days
      FROM invoices
      WHERE business_id = ${businessId}::uuid
        AND paid_at IS NOT NULL
        AND paid_at >= ${startInclusive}
        AND paid_at <  ${endExclusive}
    `;
    return rows[0]?.avg_days ?? 0;
  }

  async countActiveSequences(businessId: string): Promise<number> {
    // sequence_runs has no business_id column; scope through invoice.
    return this.prisma.sequenceRun.count({
      where: {
        status: "active",
        invoice: { businessId },
      },
    });
  }

  async getAgingBuckets(businessId: string): Promise<AgingBuckets> {
    const rows = await this.prisma.$queryRaw<AgingRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE days_overdue <= 0)                                 AS current_count,
        COALESCE(SUM(balance_due_cents) FILTER (WHERE days_overdue <= 0), 0)::bigint AS current_total,
        COUNT(*) FILTER (WHERE days_overdue BETWEEN 1 AND 30)                     AS d1_30_count,
        COALESCE(SUM(balance_due_cents) FILTER (WHERE days_overdue BETWEEN 1 AND 30), 0)::bigint AS d1_30_total,
        COUNT(*) FILTER (WHERE days_overdue BETWEEN 31 AND 60)                    AS d31_60_count,
        COALESCE(SUM(balance_due_cents) FILTER (WHERE days_overdue BETWEEN 31 AND 60), 0)::bigint AS d31_60_total,
        COUNT(*) FILTER (WHERE days_overdue BETWEEN 61 AND 90)                    AS d61_90_count,
        COALESCE(SUM(balance_due_cents) FILTER (WHERE days_overdue BETWEEN 61 AND 90), 0)::bigint AS d61_90_total,
        COUNT(*) FILTER (WHERE days_overdue >= 91)                                AS d90plus_count,
        COALESCE(SUM(balance_due_cents) FILTER (WHERE days_overdue >= 91), 0)::bigint AS d90plus_total
      FROM invoices
      WHERE business_id = ${businessId}::uuid
        AND status IN ('open', 'overdue', 'partial')
    `;
    const r = rows[0];
    return {
      current:    { totalCents: Number(r?.current_total ?? 0n), count: Number(r?.current_count ?? 0n) },
      days1to30:  { totalCents: Number(r?.d1_30_total ?? 0n),   count: Number(r?.d1_30_count ?? 0n) },
      days31to60: { totalCents: Number(r?.d31_60_total ?? 0n),  count: Number(r?.d31_60_count ?? 0n) },
      days61to90: { totalCents: Number(r?.d61_90_total ?? 0n),  count: Number(r?.d61_90_count ?? 0n) },
      days90plus: { totalCents: Number(r?.d90plus_total ?? 0n), count: Number(r?.d90plus_count ?? 0n) },
    };
  }
}
