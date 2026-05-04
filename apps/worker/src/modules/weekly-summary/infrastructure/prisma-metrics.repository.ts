import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  BusinessReadModel,
  MetricsRepository,
  OwnerRecipient,
} from "../domain/metrics.repository";
import type { BusinessMetrics } from "../domain/business-metrics";

@Injectable()
export class PrismaMetricsRepository implements MetricsRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async loadBusiness(businessId: string): Promise<BusinessReadModel | null> {
    return this.prisma.business.findFirst({
      where: { id: businessId },
      select: {
        id: true,
        accountId: true,
        name: true,
        timezone: true,
        senderEmail: true,
        senderName: true,
      },
    });
  }

  async loadOwnerRecipients(accountId: string): Promise<OwnerRecipient[]> {
    const users = await this.prisma.user.findMany({
      where: { accountId, role: "owner" },
      select: { id: true, email: true },
    });
    return users.map((u) => ({ userId: u.id, email: u.email }));
  }

  async computeMetrics(input: {
    businessId: string;
    weekStartsAt: string;
  }): Promise<BusinessMetrics> {
    const weekStart = new Date(input.weekStartsAt);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    const priorWeekStart = new Date(weekStart);
    priorWeekStart.setUTCDate(priorWeekStart.getUTCDate() - 7);
    const trailing4Start = new Date(weekStart);
    trailing4Start.setUTCDate(trailing4Start.getUTCDate() - 28);

    const businessId = input.businessId;

    const [
      recoveredThisWeek,
      recoveredPriorWeek,
      paidThisWeek,
      paidTrailing4,
      currentlyOverdue,
      topCustomers,
      flaggedRuns,
      activeSequences,
      top5OverdueInvoices,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { businessId, paidAt: { gte: weekStart, lt: weekEnd } },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          businessId,
          paidAt: { gte: priorWeekStart, lt: weekStart },
        },
        _sum: { amountCents: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          businessId,
          paidAt: { gte: weekStart, lt: weekEnd },
          issuedDate: { not: null },
        },
        select: { issuedDate: true, paidAt: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          businessId,
          paidAt: { gte: trailing4Start, lt: weekEnd },
          issuedDate: { not: null },
        },
        select: { issuedDate: true, paidAt: true },
      }),
      this.prisma.invoice.count({
        where: { businessId, status: "overdue" },
      }),
      this.prisma.customer.findMany({
        where: { businessId, totalOutstanding: { gt: 0 } },
        orderBy: { totalOutstanding: "desc" },
        take: 3,
        select: {
          id: true,
          companyName: true,
          totalOutstanding: true,
        },
      }),
      this.prisma.sequenceRun.findMany({
        where: {
          status: "completed",
          completedAt: { gte: weekStart, lt: weekEnd },
          invoice: { businessId, paidAt: null },
        },
        select: {
          id: true,
          invoice: {
            select: {
              amountCents: true,
              customer: {
                select: { id: true, companyName: true },
              },
            },
          },
        },
      }),
      this.prisma.sequenceRun.count({
        where: { status: "active", invoice: { businessId } },
      }),
      this.prisma.invoice.findMany({
        where: { businessId, status: "overdue" },
        orderBy: [{ daysOverdue: "desc" }, { amountCents: "desc" }],
        take: 5,
        select: {
          amountCents: true,
          daysOverdue: true,
          customer: { select: { companyName: true } },
        },
      }),
    ]);

    const oldestDaysOverdueByCustomer =
      topCustomers.length === 0
        ? []
        : await this.prisma.invoice.groupBy({
            by: ["customerId"],
            where: {
              businessId,
              customerId: { in: topCustomers.map((c) => c.id) },
              status: "overdue",
            },
            _max: { daysOverdue: true },
          });
    const daysMap = new Map(
      oldestDaysOverdueByCustomer.map((r) => [
        r.customerId,
        r._max.daysOverdue ?? 0,
      ]),
    );

    const avg = (
      rows: { issuedDate: Date | null; paidAt: Date | null }[],
    ): number | null => {
      if (rows.length === 0) return null;
      const total = rows.reduce((acc, r) => {
        if (!r.issuedDate || !r.paidAt) return acc;
        const days =
          (r.paidAt.getTime() - r.issuedDate.getTime()) /
          (1000 * 60 * 60 * 24);
        return acc + days;
      }, 0);
      return Math.round(total / rows.length);
    };

    return {
      weekStartsAt: input.weekStartsAt,
      recoveredThisWeekCents: recoveredThisWeek._sum.amountCents ?? 0,
      recoveredPriorWeekCents: recoveredPriorWeek._sum.amountCents ?? 0,
      invoicesCollectedCount: recoveredThisWeek._count._all,
      avgDaysToPayThisWeek: avg(paidThisWeek),
      avgDaysToPayTrailing4Weeks: avg(paidTrailing4),
      currentlyOverdueCount: currentlyOverdue,
      topOverdueCustomers: topCustomers.map((c) => ({
        customerId: c.id,
        customerName: c.companyName,
        totalOutstandingCents: c.totalOutstanding,
        oldestInvoiceDaysOverdue: daysMap.get(c.id) ?? 0,
      })),
      flaggedRuns: flaggedRuns.map((r) => ({
        runId: r.id,
        customerId: r.invoice.customer.id,
        customerName: r.invoice.customer.companyName,
        invoiceAmountCents: r.invoice.amountCents,
      })),
      activeSequencesCount: activeSequences,
      top5OverdueInvoices: top5OverdueInvoices.map((i) => ({
        customerName: i.customer.companyName,
        amountCents: i.amountCents,
        daysOverdue: i.daysOverdue,
        currentSequenceStep: null,
      })),
    };
  }
}
