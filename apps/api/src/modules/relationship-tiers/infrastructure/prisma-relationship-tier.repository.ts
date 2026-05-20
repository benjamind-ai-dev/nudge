import { Inject, Injectable } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  CreateTierData,
  RelationshipTierRepository,
  UpdateTierData,
} from "../domain/relationship-tier.repository";
import type { RelationshipTier } from "../domain/relationship-tier.entity";
import {
  BusinessHasNoDefaultTierError,
  RelationshipTierNotFoundError,
} from "../domain/relationship-tier.errors";

const ROW_SELECT = {
  id: true,
  businessId: true,
  sequenceId: true,
  name: true,
  description: true,
  isDefault: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  sequence: { select: { name: true } },
  _count: { select: { customers: true } },
} satisfies Prisma.RelationshipTierSelect;

type Row = Prisma.RelationshipTierGetPayload<{ select: typeof ROW_SELECT }>;

@Injectable()
export class PrismaRelationshipTierRepository
  implements RelationshipTierRepository
{
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findAllByBusiness(businessId: string): Promise<RelationshipTier[]> {
    const rows = await this.prisma.relationshipTier.findMany({
      where: { businessId },
      select: ROW_SELECT,
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string, businessId: string): Promise<RelationshipTier | null> {
    const row = await this.prisma.relationshipTier.findFirst({
      where: { id, businessId },
      select: ROW_SELECT,
    });
    return row ? this.toDomain(row) : null;
  }

  async nameExistsInBusiness(
    name: string,
    businessId: string,
    exceptId?: string,
  ): Promise<boolean> {
    const row = await this.prisma.relationshipTier.findFirst({
      where: {
        businessId,
        name,
        ...(exceptId && { NOT: { id: exceptId } }),
      },
      select: { id: true },
    });
    return row !== null;
  }

  async countByBusiness(businessId: string): Promise<number> {
    return this.prisma.relationshipTier.count({ where: { businessId } });
  }

  async create(
    businessId: string,
    data: CreateTierData,
  ): Promise<RelationshipTier> {
    // Compute next sortOrder atomically with the insert.
    const row = await this.prisma.$transaction(async (tx) => {
      const maxRow = await tx.relationshipTier.aggregate({
        where: { businessId },
        _max: { sortOrder: true },
      });
      const nextSortOrder = (maxRow._max.sortOrder ?? 0) + 1;

      return tx.relationshipTier.create({
        data: {
          businessId,
          name: data.name,
          description: data.description ?? null,
          isDefault: false,
          sortOrder: nextSortOrder,
        },
        select: ROW_SELECT,
      });
    });

    return this.toDomain(row);
  }

  async update(
    id: string,
    businessId: string,
    data: UpdateTierData,
  ): Promise<RelationshipTier> {
    const row = await this.prisma.$transaction(async (tx) => {
      // Tenant-scoped existence check.
      const existing = await tx.relationshipTier.findFirst({
        where: { id, businessId },
        select: { id: true },
      });
      if (!existing) throw new RelationshipTierNotFoundError(id);

      // If promoting to default, demote all OTHER tiers in this business first.
      if (data.isDefault === true) {
        await tx.relationshipTier.updateMany({
          where: { businessId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }

      // Apply the update (still tenant-scoped).
      await tx.relationshipTier.updateMany({
        where: { id, businessId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.sequenceId !== undefined && { sequenceId: data.sequenceId }),
          ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        },
      });

      const updated = await tx.relationshipTier.findFirst({
        where: { id, businessId },
        select: ROW_SELECT,
      });
      if (!updated) throw new RelationshipTierNotFoundError(id);
      return updated;
    });

    return this.toDomain(row);
  }

  async hasActiveSequenceRuns(
    tierId: string,
    businessId: string,
  ): Promise<boolean> {
    const run = await this.prisma.sequenceRun.findFirst({
      where: {
        status: { in: ["active", "paused"] },
        sequence: { relationshipTierId: tierId, businessId },
      },
      select: { id: true },
    });
    return run !== null;
  }

  async delete(id: string, businessId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Verify tier exists in this business — use updateMany pattern check.
      const target = await tx.relationshipTier.findFirst({
        where: { id, businessId },
        select: { id: true },
      });
      if (!target) throw new RelationshipTierNotFoundError(id);

      // Find the business's default tier (not the one we're deleting).
      const defaultTier = await tx.relationshipTier.findFirst({
        where: { businessId, isDefault: true, NOT: { id } },
        select: { id: true },
      });
      if (!defaultTier) {
        // Use-case-layer guard should have prevented this for the
        // "deleting default" path, but defend in depth.
        throw new BusinessHasNoDefaultTierError(businessId);
      }

      // Reassign customers off this tier to the default.
      await tx.customer.updateMany({
        where: { businessId, relationshipTierId: id },
        data: { relationshipTierId: defaultTier.id },
      });

      // Delete (tenant-scoped).
      const deleted = await tx.relationshipTier.deleteMany({
        where: { id, businessId },
      });
      if (deleted.count === 0) throw new RelationshipTierNotFoundError(id);
    });
  }

  private toDomain(row: Row): RelationshipTier {
    return {
      id: row.id,
      businessId: row.businessId,
      sequenceId: row.sequenceId,
      sequenceName: row.sequence?.name ?? null,
      name: row.name,
      description: row.description,
      isDefault: row.isDefault,
      sortOrder: row.sortOrder,
      customerCount: row._count.customers,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
