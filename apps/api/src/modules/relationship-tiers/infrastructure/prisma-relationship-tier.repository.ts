import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type { RelationshipTierRepository, UpdateTierData } from "../domain/relationship-tier.repository";
import type { RelationshipTier } from "../domain/relationship-tier.entity";
import { RelationshipTierNotFoundError } from "../domain/relationship-tier.errors";

@Injectable()
export class PrismaRelationshipTierRepository implements RelationshipTierRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findAllByBusiness(businessId: string): Promise<RelationshipTier[]> {
    const rows = await this.prisma.relationshipTier.findMany({
      where: { businessId },
      select: {
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
      },
      orderBy: { sortOrder: "asc" },
    });

    return rows.map((row) => this.toDomain(row));
  }

  async update(id: string, businessId: string, data: UpdateTierData): Promise<RelationshipTier> {
    const existing = await this.prisma.relationshipTier.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
    if (!existing) throw new RelationshipTierNotFoundError(id);

    const row = await this.prisma.relationshipTier.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.sequenceId !== undefined && { sequenceId: data.sequenceId }),
      },
      select: {
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
      },
    });

    return this.toDomain(row);
  }

  private toDomain(row: {
    id: string;
    businessId: string;
    sequenceId: string | null;
    name: string;
    description: string | null;
    isDefault: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    sequence: { name: string } | null;
  }): RelationshipTier {
    return {
      id: row.id,
      businessId: row.businessId,
      sequenceId: row.sequenceId,
      sequenceName: row.sequence?.name ?? null,
      name: row.name,
      description: row.description,
      isDefault: row.isDefault,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
