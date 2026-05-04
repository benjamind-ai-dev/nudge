import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { SEQUENCE_RUN_STATUSES, STOPPED_REASONS } from "@nudge/shared";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  OverdueInvoiceRow,
  SequenceFirstStep,
  SequenceTriggerRepository,
} from "../domain/sequence-trigger.repository";

@Injectable()
export class PrismaSequenceTriggerRepository implements SequenceTriggerRepository {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async findOverdueInvoicesWithoutRun(
    limit: number,
    offset: number,
  ): Promise<OverdueInvoiceRow[]> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        status: "overdue",
        sequenceRuns: {
          none: {
            OR: [
              { status: { in: [SEQUENCE_RUN_STATUSES.ACTIVE, SEQUENCE_RUN_STATUSES.PAUSED] } },
              { stoppedReason: STOPPED_REASONS.CLIENT_REPLIED },
            ],
          },
        },
        business: {
          connections: {
            some: { status: "connected" },
          },
        },
      },
      select: {
        id: true,
        invoiceNumber: true,
        customerId: true,
        dueDate: true,
        businessId: true,
        customer: {
          select: {
            sequenceId: true,
            relationshipTierId: true,
            relationshipTier: {
              select: { sequenceId: true },
            },
          },
        },
        business: {
          select: { timezone: true },
        },
      },
      take: limit,
      skip: offset,
      orderBy: { dueDate: "asc" },
    });

    return rows.map((row) => ({
      invoiceId: row.id,
      invoiceNumber: row.invoiceNumber,
      customerId: row.customerId,
      customerSequenceId: row.customer.sequenceId,
      customerTierId: row.customer.relationshipTierId,
      customerTierSequenceId: row.customer.relationshipTier?.sequenceId ?? null,
      dueDate: row.dueDate,
      businessId: row.businessId,
      businessTimezone: row.business.timezone,
    }));
  }

  async findDefaultTierSequenceId(businessId: string): Promise<string | null> {
    const tier = await this.prisma.relationshipTier.findFirst({
      where: { businessId, isDefault: true },
      select: { sequenceId: true },
    });
    return tier?.sequenceId ?? null;
  }

  async findSequenceFirstStep(sequenceId: string): Promise<SequenceFirstStep | null> {
    const step = await this.prisma.sequenceStep.findFirst({
      where: { sequenceId },
      select: { id: true, delayDays: true },
      orderBy: { stepOrder: "asc" },
    });
    return step ? { firstStepId: step.id, firstStepDelayDays: step.delayDays } : null;
  }

  async createSequenceRun(data: {
    invoiceId: string;
    sequenceId: string;
    currentStepId: string;
    status: "active";
    nextSendAt: Date;
    startedAt: Date;
  }): Promise<{ created: boolean; runId: string | null }> {
    try {
      const run = await this.prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({
          where: { id: data.invoiceId },
          select: { status: true },
        });

        if (
          !invoice ||
          (invoice.status !== "open" &&
            invoice.status !== "overdue" &&
            invoice.status !== "partial")
        ) {
          return null;
        }

        const existing = await tx.sequenceRun.findFirst({
          where: {
            invoiceId: data.invoiceId,
            status: { in: [SEQUENCE_RUN_STATUSES.ACTIVE, SEQUENCE_RUN_STATUSES.PAUSED] },
          },
          select: { id: true },
        });

        if (existing) return null;

        return tx.sequenceRun.create({
          data: {
            invoiceId: data.invoiceId,
            sequenceId: data.sequenceId,
            currentStepId: data.currentStepId,
            status: data.status,
            nextSendAt: data.nextSendAt,
            startedAt: data.startedAt,
          },
          select: { id: true },
        });
      });

      return run ? { created: true, runId: run.id } : { created: false, runId: null };
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        return { created: false, runId: null };
      }
      throw error;
    }
  }
}
