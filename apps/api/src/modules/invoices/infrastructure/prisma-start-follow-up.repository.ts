import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { SEQUENCE_RUN_STATUSES } from "@nudge/shared";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  CreateSequenceRunData,
  FollowUpContext,
  SequenceFirstStep,
  StartFollowUpRepository,
} from "../domain/start-follow-up.repository";

@Injectable()
export class PrismaStartFollowUpRepository implements StartFollowUpRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async getFollowUpContext(
    invoiceId: string,
    businessId: string,
  ): Promise<FollowUpContext | null> {
    const row = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, businessId },
      select: {
        status: true,
        dueDate: true,
        customerId: true,
        customer: {
          select: {
            sequenceId: true,
            sequence: { select: { isActive: true } },
            relationshipTier: {
              select: {
                sequenceId: true,
                sequence: { select: { isActive: true } },
              },
            },
          },
        },
        business: { select: { timezone: true } },
      },
    });

    if (!row) return null;

    return {
      status: row.status,
      dueDate: row.dueDate,
      businessTimezone: row.business.timezone,
      customerId: row.customerId,
      customerSequenceId: row.customer.sequenceId,
      customerSequenceIsActive: row.customer.sequence?.isActive ?? null,
      customerTierSequenceId: row.customer.relationshipTier?.sequenceId ?? null,
      customerTierSequenceIsActive:
        row.customer.relationshipTier?.sequence?.isActive ?? null,
    };
  }

  async findDefaultTierSequenceId(businessId: string): Promise<string | null> {
    const tier = await this.prisma.relationshipTier.findFirst({
      where: { businessId, isDefault: true, sequence: { isActive: true } },
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

  async createSequenceRun(
    data: CreateSequenceRunData,
  ): Promise<{ created: boolean; runId: string | null }> {
    try {
      const run = await this.prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findFirst({
          where: { id: data.invoiceId, businessId: data.businessId },
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
            status: {
              in: [SEQUENCE_RUN_STATUSES.ACTIVE, SEQUENCE_RUN_STATUSES.PAUSED],
            },
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
