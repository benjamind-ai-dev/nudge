import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type { CustomerRepository, UpdateCustomerData } from "../domain/customer.repository";
import type { Customer } from "../domain/customer.entity";
import { CustomerNotFoundError } from "../domain/customer.errors";

@Injectable()
export class PrismaCustomerRepository implements CustomerRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findAllByBusiness(businessId: string): Promise<Customer[]> {
    const rows = await this.prisma.customer.findMany({
      where: { businessId, isActive: true },
      select: {
        id: true,
        businessId: true,
        companyName: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        relationshipTierId: true,
        sequenceId: true,
        totalOutstanding: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        relationshipTier: { select: { name: true } },
        sequence: { select: { name: true } },
      },
      orderBy: { companyName: "asc" },
    });

    return rows.map((row) => this.toDomain(row));
  }

  async update(id: string, businessId: string, data: UpdateCustomerData): Promise<Customer> {
    const existing = await this.prisma.customer.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
    if (!existing) throw new CustomerNotFoundError(id);

    const row = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(data.relationshipTierId !== undefined && { relationshipTierId: data.relationshipTierId }),
        ...(data.sequenceId !== undefined && { sequenceId: data.sequenceId }),
      },
      select: {
        id: true,
        businessId: true,
        companyName: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        relationshipTierId: true,
        sequenceId: true,
        totalOutstanding: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        relationshipTier: { select: { name: true } },
        sequence: { select: { name: true } },
      },
    });

    return this.toDomain(row);
  }

  private toDomain(row: {
    id: string;
    businessId: string;
    companyName: string;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    relationshipTierId: string | null;
    sequenceId: string | null;
    totalOutstanding: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    relationshipTier: { name: string } | null;
    sequence: { name: string } | null;
  }): Customer {
    return {
      id: row.id,
      businessId: row.businessId,
      companyName: row.companyName,
      contactName: row.contactName,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      relationshipTierId: row.relationshipTierId,
      tierName: row.relationshipTier?.name ?? null,
      sequenceId: row.sequenceId,
      sequenceName: row.sequence?.name ?? null,
      totalOutstanding: row.totalOutstanding,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
