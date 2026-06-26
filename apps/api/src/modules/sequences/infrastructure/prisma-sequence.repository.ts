import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { SEQUENCE_RUN_STATUSES, PAUSED_REASONS, STOPPED_REASONS } from "@nudge/shared";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  SequenceRepository,
  CreateSequenceData,
  UpdateSequenceData,
  CreateStepData,
  UpdateStepData,
  ReplaceSequenceData,
} from "../domain/sequence.repository";
import type { SequenceSummary, SequenceStep, SequenceWithSteps } from "../domain/sequence.entity";
import { SequenceNotFoundError, SequenceStepNotFoundError } from "../domain/sequence.errors";

const STEP_SELECT = {
  id: true,
  templateId: true,
  stepOrder: true,
  delayDays: true,
  channel: true,
  subjectTemplate: true,
  bodyTemplate: true,
  smsBodyTemplate: true,
  isOwnerAlert: true,
  includePaymentLink: true,
  createdAt: true,
  updatedAt: true,
} as const;

// RelationshipTier has a sortOrder field — sort by sortOrder ASC NULLS LAST, then name ASC
const SUMMARY_SELECT = {
  id: true,
  businessId: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      steps: true,
      runs: { where: { status: SEQUENCE_RUN_STATUSES.ACTIVE } },
      tiersUsingAsDefault: true,
      customersUsingAsOverride: true,
    },
  },
  runs: { select: { id: true }, take: 1 },
  relationshipTier: {
    select: { id: true, name: true },
  },
} as const;

function toStep(row: {
  id: string;
  templateId: string | null;
  stepOrder: number;
  delayDays: number;
  channel: string;
  subjectTemplate: string | null;
  bodyTemplate: string;
  smsBodyTemplate: string | null;
  isOwnerAlert: boolean;
  includePaymentLink: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SequenceStep {
  return {
    id: row.id,
    templateId: row.templateId,
    stepOrder: row.stepOrder,
    delayDays: row.delayDays,
    channel: row.channel as SequenceStep["channel"],
    subjectTemplate: row.subjectTemplate,
    bodyTemplate: row.bodyTemplate,
    smsBodyTemplate: row.smsBodyTemplate,
    isOwnerAlert: row.isOwnerAlert,
    includePaymentLink: row.includePaymentLink,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSummary(row: {
  id: string;
  businessId: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { steps: number; runs: number; tiersUsingAsDefault: number; customersUsingAsOverride: number };
  runs: { id: string }[];
  relationshipTier: { id: string; name: string } | null;
}): SequenceSummary {
  const activeRuns = row._count.runs;
  const hasAnyRun = row.runs.length > 0;
  const assigned = row._count.tiersUsingAsDefault > 0 || row._count.customersUsingAsOverride > 0;
  const inUseReason: SequenceSummary["inUseReason"] =
    activeRuns > 0 ? "running" : assigned ? "assigned" : hasAnyRun ? "history" : null;
  return {
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    isActive: row.isActive,
    stepCount: row._count.steps,
    activeRuns,
    inUse: inUseReason !== null,
    inUseReason,
    relationshipTier: row.relationshipTier
      ? { id: row.relationshipTier.id, name: row.relationshipTier.name }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaSequenceRepository implements SequenceRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findAllByBusiness(businessId: string): Promise<SequenceSummary[]> {
    const rows = await this.prisma.sequence.findMany({
      where: { businessId },
      select: SUMMARY_SELECT,
      // Sort by relationship tier sortOrder ASC NULLS LAST, then name ASC
      orderBy: [
        { relationshipTier: { sortOrder: "asc" } },
        { name: "asc" },
      ],
    });
    return rows.map(toSummary);
  }

  async findById(id: string, businessId: string): Promise<SequenceWithSteps | null> {
    const row = await this.prisma.sequence.findFirst({
      where: { id, businessId },
      select: {
        ...SUMMARY_SELECT,
        steps: { select: STEP_SELECT, orderBy: { stepOrder: "asc" } },
      },
    });
    if (!row) return null;
    return {
      ...toSummary(row),
      steps: row.steps.map(toStep),
    };
  }

  async create(data: CreateSequenceData): Promise<SequenceSummary> {
    const row = await this.prisma.sequence.create({
      data: {
        businessId: data.businessId,
        name: data.name,
        ...(data.relationshipTierId !== undefined && { relationshipTierId: data.relationshipTierId }),
      },
      select: SUMMARY_SELECT,
    });
    return toSummary(row);
  }

  async createWithSteps(data: CreateSequenceData & { steps: CreateStepData[] }): Promise<SequenceWithSteps> {
    const row = await this.prisma.sequence.create({
      data: {
        businessId: data.businessId,
        name: data.name,
        ...(data.relationshipTierId !== undefined && { relationshipTierId: data.relationshipTierId }),
        steps: {
          create: data.steps.map((s) => ({
            templateId: s.templateId ?? null,
            stepOrder: s.stepOrder,
            delayDays: s.delayDays,
            channel: s.channel,
            subjectTemplate: s.subjectTemplate ?? null,
            bodyTemplate: s.bodyTemplate,
            smsBodyTemplate: s.smsBodyTemplate ?? null,
            isOwnerAlert: s.isOwnerAlert ?? false,
            includePaymentLink: s.includePaymentLink ?? true,
          })),
        },
      },
      select: {
        ...SUMMARY_SELECT,
        steps: { select: STEP_SELECT, orderBy: { stepOrder: "asc" } },
      },
    });
    return {
      ...toSummary(row),
      steps: row.steps.map(toStep),
    };
  }

  async countByBusiness(businessId: string): Promise<number> {
    return this.prisma.sequence.count({ where: { businessId } });
  }

  async countActiveRuns(sequenceId: string, businessId: string): Promise<number> {
    return this.prisma.sequenceRun.count({
      where: { sequenceId, status: SEQUENCE_RUN_STATUSES.ACTIVE, sequence: { businessId } },
    });
  }

  async hasRuns(id: string, businessId: string): Promise<boolean> {
    // Any run (active or historical) — SequenceRun.sequence is onDelete: Restrict,
    // so deleting a sequence with runs fails at the DB. Block it with a clear error.
    const count = await this.prisma.sequenceRun.count({
      where: { sequenceId: id, sequence: { businessId } },
    });
    return count > 0;
  }

  async replaceSteps(id: string, businessId: string, data: ReplaceSequenceData): Promise<SequenceWithSteps> {
    const existing = await this.prisma.sequence.findFirst({ where: { id, businessId }, select: { id: true } });
    if (!existing) throw new SequenceNotFoundError(id);

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.sequenceStep.deleteMany({ where: { sequenceId: id } });
      return tx.sequence.update({
        where: { id },
        data: {
          name: data.name,
          ...(data.relationshipTierId !== undefined && { relationshipTierId: data.relationshipTierId }),
          steps: {
            create: data.steps.map((s) => ({
              templateId: s.templateId ?? null,
              stepOrder: s.stepOrder,
              delayDays: s.delayDays,
              channel: s.channel,
              subjectTemplate: s.subjectTemplate ?? null,
              bodyTemplate: s.bodyTemplate,
              smsBodyTemplate: s.smsBodyTemplate ?? null,
              isOwnerAlert: s.isOwnerAlert ?? false,
              includePaymentLink: s.includePaymentLink ?? true,
            })),
          },
        },
        select: {
          ...SUMMARY_SELECT,
          steps: { select: STEP_SELECT, orderBy: { stepOrder: "asc" } },
        },
      });
    });

    return {
      ...toSummary(row),
      steps: row.steps.map(toStep),
    };
  }

  async findSenderName(businessId: string): Promise<string | null> {
    const row = await this.prisma.business.findFirst({
      where: { id: businessId },
      select: { senderName: true },
    });
    return row?.senderName ?? null;
  }

  async update(id: string, businessId: string, data: UpdateSequenceData): Promise<SequenceSummary> {
    const existing = await this.prisma.sequence.findFirst({ where: { id, businessId }, select: { id: true } });
    if (!existing) throw new SequenceNotFoundError(id);
    const row = await this.prisma.sequence.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.relationshipTierId !== undefined && { relationshipTierId: data.relationshipTierId }),
      },
      select: SUMMARY_SELECT,
    });
    return toSummary(row);
  }

  async delete(id: string, businessId: string): Promise<void> {
    const existing = await this.prisma.sequence.findFirst({ where: { id, businessId }, select: { id: true } });
    if (!existing) throw new SequenceNotFoundError(id);
    await this.prisma.sequence.deleteMany({ where: { id, businessId } });
  }

  async isReferencedByTierOrCustomer(id: string, businessId: string): Promise<boolean> {
    const [tierCount, customerCount] = await Promise.all([
      this.prisma.relationshipTier.count({ where: { sequenceId: id, businessId } }),
      this.prisma.customer.count({ where: { sequenceId: id, businessId } }),
    ]);
    return tierCount > 0 || customerCount > 0;
  }

  async addStep(sequenceId: string, businessId: string, data: CreateStepData): Promise<SequenceStep> {
    const seq = await this.prisma.sequence.findFirst({ where: { id: sequenceId, businessId }, select: { id: true } });
    if (!seq) throw new SequenceNotFoundError(sequenceId);
    const row = await this.prisma.sequenceStep.create({
      data: {
        sequenceId,
        templateId: data.templateId ?? null,
        stepOrder: data.stepOrder,
        delayDays: data.delayDays,
        channel: data.channel,
        subjectTemplate: data.subjectTemplate ?? null,
        bodyTemplate: data.bodyTemplate,
        smsBodyTemplate: data.smsBodyTemplate ?? null,
        isOwnerAlert: data.isOwnerAlert ?? false,
        ...(data.includePaymentLink !== undefined && { includePaymentLink: data.includePaymentLink }),
      },
      select: STEP_SELECT,
    });
    return toStep(row);
  }

  async updateStep(stepId: string, sequenceId: string, businessId: string, data: UpdateStepData): Promise<SequenceStep> {
    const seq = await this.prisma.sequence.findFirst({ where: { id: sequenceId, businessId }, select: { id: true } });
    if (!seq) throw new SequenceNotFoundError(sequenceId);
    const step = await this.prisma.sequenceStep.findFirst({ where: { id: stepId, sequenceId }, select: { id: true } });
    if (!step) throw new SequenceStepNotFoundError(stepId);
    // Update scoped by sequenceId to prevent cross-tenant mutations
    await this.prisma.sequenceStep.updateMany({
      where: { id: stepId, sequenceId },
      data: {
        ...(data.templateId !== undefined && { templateId: data.templateId }),
        ...(data.stepOrder !== undefined && { stepOrder: data.stepOrder }),
        ...(data.delayDays !== undefined && { delayDays: data.delayDays }),
        ...(data.channel !== undefined && { channel: data.channel }),
        ...(data.subjectTemplate !== undefined && { subjectTemplate: data.subjectTemplate }),
        ...(data.bodyTemplate !== undefined && { bodyTemplate: data.bodyTemplate }),
        ...(data.smsBodyTemplate !== undefined && { smsBodyTemplate: data.smsBodyTemplate }),
        ...(data.isOwnerAlert !== undefined && { isOwnerAlert: data.isOwnerAlert }),
        ...(data.includePaymentLink !== undefined && { includePaymentLink: data.includePaymentLink }),
      },
    });
    const updated = await this.prisma.sequenceStep.findFirst({
      where: { id: stepId, sequenceId },
      select: STEP_SELECT,
    });
    if (!updated) throw new SequenceStepNotFoundError(stepId);
    return toStep(updated);
  }

  async deleteStep(stepId: string, sequenceId: string, businessId: string): Promise<void> {
    const seq = await this.prisma.sequence.findFirst({ where: { id: sequenceId, businessId }, select: { id: true } });
    if (!seq) throw new SequenceNotFoundError(sequenceId);
    const step = await this.prisma.sequenceStep.findFirst({ where: { id: stepId, sequenceId }, select: { id: true } });
    if (!step) throw new SequenceStepNotFoundError(stepId);
    await this.prisma.sequenceStep.deleteMany({ where: { id: stepId, sequenceId } });
  }

  async reorderSteps(sequenceId: string, businessId: string, stepOrders: Array<{ stepId: string; stepOrder: number }>): Promise<void> {
    const seq = await this.prisma.sequence.findFirst({ where: { id: sequenceId, businessId }, select: { id: true } });
    if (!seq) throw new SequenceNotFoundError(sequenceId);
    // Use updateMany with sequenceId filter to enforce tenant isolation on each step
    await this.prisma.$transaction(
      stepOrders.map(({ stepId, stepOrder }) =>
        this.prisma.sequenceStep.updateMany({
          where: { id: stepId, sequenceId },
          data: { stepOrder },
        }),
      ),
    );
  }

  async pauseActiveRuns(sequenceId: string, businessId: string): Promise<number> {
    const result = await this.prisma.sequenceRun.updateMany({
      where: {
        sequenceId,
        status: SEQUENCE_RUN_STATUSES.ACTIVE,
        sequence: { businessId },
      },
      data: {
        status: SEQUENCE_RUN_STATUSES.PAUSED,
        pausedReason: PAUSED_REASONS.SEQUENCE_PAUSED,
      },
    });
    return result.count;
  }

  async resumeSequencePausedRuns(sequenceId: string, businessId: string): Promise<number> {
    const result = await this.prisma.sequenceRun.updateMany({
      where: {
        sequenceId,
        status: SEQUENCE_RUN_STATUSES.PAUSED,
        pausedReason: PAUSED_REASONS.SEQUENCE_PAUSED,
        sequence: { businessId },
      },
      data: {
        status: SEQUENCE_RUN_STATUSES.ACTIVE,
        pausedReason: null,
      },
    });
    return result.count;
  }

  async stopRunsForCustomerOnSequence(sequenceId: string, businessId: string, customerId: string): Promise<number> {
    // SequenceRun has no direct customerId — customer is reached via invoice.customerId
    const result = await this.prisma.sequenceRun.updateMany({
      where: {
        sequenceId,
        status: { in: [SEQUENCE_RUN_STATUSES.ACTIVE, SEQUENCE_RUN_STATUSES.PAUSED] },
        sequence: { businessId },
        invoice: { customerId },
      },
      data: {
        status: SEQUENCE_RUN_STATUSES.STOPPED,
        stoppedReason: STOPPED_REASONS.MANUALLY_STOPPED,
        completedAt: new Date(),
      },
    });
    return result.count;
  }

  async clearCustomerOverrideIfPointsHere(sequenceId: string, businessId: string, customerId: string): Promise<boolean> {
    const result = await this.prisma.customer.updateMany({
      where: { id: customerId, businessId, sequenceId },
      data: { sequenceId: null },
    });
    return result.count > 0;
  }
}
