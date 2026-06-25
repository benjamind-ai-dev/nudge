import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { SEQUENCE_RUN_STATUSES, STOPPED_REASONS } from "@nudge/shared";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type { EnrollmentRepository, EnrollTarget, InvoiceEnrollContext } from "../domain/enrollment.repository";

const CHASEABLE = ["open", "overdue", "partial"];

@Injectable()
export class PrismaEnrollmentRepository implements EnrollmentRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findEnrollTarget(sequenceId: string, businessId: string): Promise<EnrollTarget | null> {
    const seq = await this.prisma.sequence.findFirst({
      where: { id: sequenceId, businessId },
      select: {
        isActive: true,
        steps: { orderBy: { stepOrder: "asc" }, take: 1, select: { id: true, delayDays: true } },
      },
    });
    if (!seq) return null;
    const first = seq.steps[0];
    return { isActive: seq.isActive, firstStepId: first?.id ?? "", firstStepDelayDays: first?.delayDays ?? 0 };
  }

  async getInvoiceContext(invoiceId: string, businessId: string): Promise<InvoiceEnrollContext | null> {
    const row = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, businessId },
      select: {
        status: true,
        dueDate: true,
        business: { select: { timezone: true } },
        sequenceRuns: {
          where: { status: { in: [SEQUENCE_RUN_STATUSES.ACTIVE, SEQUENCE_RUN_STATUSES.PAUSED] } },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!row) return null;
    return {
      invoiceId,
      status: row.status,
      dueDate: row.dueDate,
      businessTimezone: row.business.timezone,
      activeRunId: row.sequenceRuns[0]?.id ?? null,
    };
  }

  async findChaseableInvoiceIdsForCustomer(customerId: string, businessId: string): Promise<string[]> {
    const rows = await this.prisma.invoice.findMany({
      where: { customerId, businessId, status: { in: CHASEABLE } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async moveAndCreateRun(args: {
    invoiceId: string;
    businessId: string;
    sequenceId: string;
    currentStepId: string;
    nextSendAt: Date;
  }): Promise<{ moved: boolean; runId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.sequenceRun.findFirst({
        where: {
          invoiceId: args.invoiceId,
          invoice: { businessId: args.businessId },
          status: { in: [SEQUENCE_RUN_STATUSES.ACTIVE, SEQUENCE_RUN_STATUSES.PAUSED] },
        },
        select: { id: true },
      });
      let moved = false;
      if (existing) {
        await tx.sequenceRun.update({
          where: { id: existing.id },
          data: {
            status: SEQUENCE_RUN_STATUSES.STOPPED,
            stoppedReason: STOPPED_REASONS.REASSIGNED,
            completedAt: new Date(),
          },
        });
        moved = true;
      }
      const run = await tx.sequenceRun.create({
        data: {
          invoiceId: args.invoiceId,
          sequenceId: args.sequenceId,
          currentStepId: args.currentStepId,
          status: SEQUENCE_RUN_STATUSES.ACTIVE,
          nextSendAt: args.nextSendAt,
          startedAt: new Date(),
        },
        select: { id: true },
      });
      return { moved, runId: run.id };
    });
  }

  async setCustomerSequenceOverride(customerId: string, businessId: string, sequenceId: string): Promise<boolean> {
    const res = await this.prisma.customer.updateMany({
      where: { id: customerId, businessId },
      data: { sequenceId },
    });
    return res.count > 0;
  }
}
