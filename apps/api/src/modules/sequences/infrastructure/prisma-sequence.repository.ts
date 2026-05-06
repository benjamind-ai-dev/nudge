import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  SequenceRepository,
  CreateSequenceData,
  UpdateSequenceData,
  CreateStepData,
  UpdateStepData,
} from "../domain/sequence.repository";
import type { SequenceSummary, SequenceStep, SequenceWithSteps } from "../domain/sequence.entity";
import { SequenceNotFoundError, SequenceStepNotFoundError } from "../domain/sequence.errors";

const STEP_SELECT = {
  id: true,
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

function toStep(row: {
  id: string;
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

@Injectable()
export class PrismaSequenceRepository implements SequenceRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findAllByBusiness(businessId: string): Promise<SequenceSummary[]> {
    const rows = await this.prisma.sequence.findMany({
      where: { businessId },
      select: {
        id: true,
        businessId: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { steps: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      businessId: r.businessId,
      name: r.name,
      stepCount: r._count.steps,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async findById(id: string, businessId: string): Promise<SequenceWithSteps | null> {
    const row = await this.prisma.sequence.findFirst({
      where: { id, businessId },
      select: {
        id: true,
        businessId: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { steps: true } },
        steps: { select: STEP_SELECT, orderBy: { stepOrder: "asc" } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      businessId: row.businessId,
      name: row.name,
      stepCount: row._count.steps,
      steps: row.steps.map(toStep),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async create(data: CreateSequenceData): Promise<SequenceSummary> {
    const row = await this.prisma.sequence.create({
      data: { businessId: data.businessId, name: data.name },
      select: {
        id: true,
        businessId: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { steps: true } },
      },
    });
    return { id: row.id, businessId: row.businessId, name: row.name, stepCount: 0, createdAt: row.createdAt, updatedAt: row.updatedAt };
  }

  async update(id: string, businessId: string, data: UpdateSequenceData): Promise<SequenceSummary> {
    const existing = await this.prisma.sequence.findFirst({ where: { id, businessId }, select: { id: true } });
    if (!existing) throw new SequenceNotFoundError(id);
    const row = await this.prisma.sequence.update({
      where: { id },
      data: { ...(data.name !== undefined && { name: data.name }) },
      select: {
        id: true,
        businessId: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { steps: true } },
      },
    });
    return { id: row.id, businessId: row.businessId, name: row.name, stepCount: row._count.steps, createdAt: row.createdAt, updatedAt: row.updatedAt };
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
}
