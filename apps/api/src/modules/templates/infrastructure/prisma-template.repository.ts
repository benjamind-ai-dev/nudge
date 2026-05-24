import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  CreateTemplateInput,
  TemplateCustomerVerifier,
  TemplateRepository,
  UpdateTemplateInput,
} from "../domain/template.repository";
import type { Template } from "../domain/template.entity";

function toDomain(row: {
  id: string;
  businessId: string;
  name: string;
  subject: string | null;
  body: string;
  signature: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Template {
  return {
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    subject: row.subject,
    body: row.body,
    signature: row.signature,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaTemplateRepository implements TemplateRepository {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async list(businessId: string): Promise<Template[]> {
    const rows = await this.prisma.template.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomain);
  }

  async findById(id: string, businessId: string): Promise<Template | null> {
    const row = await this.prisma.template.findFirst({ where: { id, businessId } });
    return row ? toDomain(row) : null;
  }

  async create(input: CreateTemplateInput): Promise<Template> {
    const row = await this.prisma.template.create({
      data: {
        businessId: input.businessId,
        name: input.name,
        subject: input.subject,
        body: input.body,
        signature: input.signature,
      },
    });
    return toDomain(row);
  }

  async update(
    id: string,
    businessId: string,
    patch: UpdateTemplateInput,
  ): Promise<Template | null> {
    const result = await this.prisma.template.updateMany({
      where: { id, businessId },
      data: patch,
    });
    if (result.count === 0) return null;
    const row = await this.prisma.template.findFirst({ where: { id, businessId } });
    return row ? toDomain(row) : null;
  }

  async delete(id: string, businessId: string): Promise<boolean> {
    const result = await this.prisma.template.deleteMany({ where: { id, businessId } });
    return result.count > 0;
  }

  async attachToCustomer(
    templateId: string,
    customerId: string,
    businessId: string,
  ): Promise<void> {
    // Verify both the template and customer belong to the business before
    // writing the join row — prevents cross-tenant association.
    const [template, customer] = await Promise.all([
      this.prisma.template.findFirst({ where: { id: templateId, businessId }, select: { id: true } }),
      this.prisma.customer.findFirst({ where: { id: customerId, businessId }, select: { id: true } }),
    ]);
    if (!template || !customer) return;
    await this.prisma.customerTemplate.upsert({
      where: { customerId_templateId: { customerId, templateId } },
      create: { customerId, templateId },
      update: {},
    });
  }

  async detachFromCustomer(
    templateId: string,
    customerId: string,
    businessId: string,
  ): Promise<void> {
    // Verify the template belongs to the business before removing the join row.
    const template = await this.prisma.template.findFirst({
      where: { id: templateId, businessId },
      select: { id: true },
    });
    if (!template) return;
    await this.prisma.customerTemplate.deleteMany({
      where: { customerId, templateId },
    });
  }
}

@Injectable()
export class PrismaTemplateCustomerVerifier implements TemplateCustomerVerifier {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async customerExistsInBusiness(
    customerId: string,
    businessId: string,
  ): Promise<boolean> {
    const count = await this.prisma.customer.count({
      where: { id: customerId, businessId },
    });
    return count > 0;
  }
}
