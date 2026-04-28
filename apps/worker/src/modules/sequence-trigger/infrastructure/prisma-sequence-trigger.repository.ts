import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  OverdueInvoiceRow,
  SequenceTriggerRepository,
  TierWithSequence,
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
            status: { in: ["active", "paused"] },
          },
        },
        business: {
          connections: {
            some: {
              status: "connected",
            },
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
            relationshipTierId: true,
          },
        },
        business: {
          select: {
            timezone: true,
          },
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
      customerTierId: row.customer.relationshipTierId,
      dueDate: row.dueDate,
      businessId: row.businessId,
      businessTimezone: row.business.timezone,
    }));
  }

  async findDefaultTier(businessId: string): Promise<{ id: string; name: string } | null> {
    const tier = await this.prisma.relationshipTier.findFirst({
      where: { businessId, isDefault: true },
      select: { id: true, name: true },
    });
    return tier;
  }

  async findActiveSequenceForTier(tierId: string): Promise<TierWithSequence | null> {
    const sequence = await this.prisma.sequence.findFirst({
      where: {
        relationshipTierId: tierId,
        isActive: true,
      },
      select: {
        id: true,
        relationshipTier: {
          select: { id: true, name: true },
        },
        steps: {
          select: { id: true, delayDays: true },
          orderBy: { stepOrder: "asc" },
          take: 1,
        },
      },
    });

    if (!sequence || sequence.steps.length === 0) {
      return null;
    }

    return {
      tierId: sequence.relationshipTier.id,
      tierName: sequence.relationshipTier.name,
      sequenceId: sequence.id,
      firstStepId: sequence.steps[0].id,
      firstStepDelayDays: sequence.steps[0].delayDays,
    };
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

        // Guard: only create runs for invoices in a contributing status. If the
        // invoice was paid/voided/etc. between the trigger query and now (concurrent
        // sync committed an applyChange), abort to avoid dunning a paid invoice.
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
            status: { in: ["active", "paused"] },
          },
          select: { id: true },
        });

        if (existing) {
          return null;
        }

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
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        return { created: false, runId: null };
      }
      throw error;
    }
  }
}
