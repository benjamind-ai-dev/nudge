import { Inject, Injectable } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  Customer,
  CustomerDetail,
  CustomerRecentInvoice,
} from "../domain/customer.entity";
import type {
  CustomerListFilter,
  CustomerListResult,
  CustomerRepository,
  UpdateCustomerData,
} from "../domain/customer.repository";
import { CustomerNotFoundError } from "../domain/customer.errors";

const LIST_SELECT = {
  id: true,
  businessId: true,
  companyName: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  relationshipTierId: true,
  sequenceId: true,
  paymentTerms: true,
  avgDaysToPay: true,
  totalOutstanding: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  relationshipTier: { select: { id: true, name: true } },
} satisfies Prisma.CustomerSelect;

type ListRow = Prisma.CustomerGetPayload<{ select: typeof LIST_SELECT }>;

@Injectable()
export class PrismaCustomerRepository implements CustomerRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findManyByFilter(filter: CustomerListFilter): Promise<CustomerListResult> {
    const where = this.buildWhere(filter);
    const orderBy = this.buildOrderBy(filter);
    const skip = (filter.page - 1) * filter.limit;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        select: LIST_SELECT,
        orderBy,
        skip,
        take: filter.limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { items: rows.map((row) => this.toCustomer(row)), total };
  }

  async findDetailById(id: string, businessId: string): Promise<CustomerDetail | null> {
    const [row, activeSequenceRunCount] = await this.prisma.$transaction([
      this.prisma.customer.findFirst({
        where: { id, businessId },
        select: {
          ...LIST_SELECT,
          invoices: {
            orderBy: { dueDate: "desc" },
            take: 10,
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              amountCents: true,
              balanceDueCents: true,
              dueDate: true,
              daysOverdue: true,
            },
          },
          messages: {
            orderBy: { sentAt: { sort: "desc", nulls: "last" } },
            take: 1,
            select: { sentAt: true },
          },
        },
      }),
      this.prisma.sequenceRun.count({
        where: {
          status: { in: ["active", "paused"] },
          invoice: { customerId: id, businessId },
        },
      }),
    ]);

    if (!row) return null;

    const recentInvoices: CustomerRecentInvoice[] = row.invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      amountCents: inv.amountCents,
      balanceDueCents: inv.balanceDueCents,
      dueDate: inv.dueDate,
      daysOverdue: inv.daysOverdue,
    }));

    return {
      ...this.toCustomer(row),
      recentInvoices,
      activeSequenceRunCount,
      lastMessageSentAt: row.messages[0]?.sentAt ?? null,
    };
  }

  async update(id: string, businessId: string, data: UpdateCustomerData): Promise<Customer> {
    const result = await this.prisma.customer.updateMany({
      where: { id, businessId },
      data: {
        ...(data.relationshipTierId !== undefined && { relationshipTierId: data.relationshipTierId }),
        ...(data.sequenceId !== undefined && { sequenceId: data.sequenceId }),
      },
    });
    if (result.count === 0) throw new CustomerNotFoundError(id);

    const row = await this.prisma.customer.findFirst({
      where: { id, businessId },
      select: LIST_SELECT,
    });
    if (!row) throw new CustomerNotFoundError(id);
    return this.toCustomer(row);
  }

  async tierBelongsToBusiness(tierId: string, businessId: string): Promise<boolean> {
    const row = await this.prisma.relationshipTier.findFirst({
      where: { id: tierId, businessId },
      select: { id: true },
    });
    return row !== null;
  }

  async sequenceBelongsToBusiness(sequenceId: string, businessId: string): Promise<boolean> {
    const row = await this.prisma.sequence.findFirst({
      where: { id: sequenceId, businessId },
      select: { id: true },
    });
    return row !== null;
  }

  private buildWhere(filter: CustomerListFilter): Prisma.CustomerWhereInput {
    const where: Prisma.CustomerWhereInput = { businessId: filter.businessId };
    if (!filter.includeInactive) where.isActive = true;
    if (filter.tierId) where.relationshipTierId = filter.tierId;
    if (filter.hasOverdue) {
      where.invoices = { some: { status: { in: ["overdue", "partial"] } } };
    }
    if (filter.search) {
      where.OR = [
        { companyName: { contains: filter.search, mode: "insensitive" } },
        { contactName: { contains: filter.search, mode: "insensitive" } },
        { contactEmail: { contains: filter.search, mode: "insensitive" } },
      ];
    }
    return where;
  }

  private buildOrderBy(filter: CustomerListFilter): Prisma.CustomerOrderByWithRelationInput[] {
    const order = filter.sortOrder;
    const primary: Prisma.CustomerOrderByWithRelationInput =
      filter.sortBy === "company_name"
        ? { companyName: order }
        : filter.sortBy === "total_outstanding"
          ? { totalOutstanding: order }
          : { avgDaysToPay: order };
    return [primary, { id: "desc" }];
  }

  private toCustomer(row: ListRow): Customer {
    return {
      id: row.id,
      businessId: row.businessId,
      companyName: row.companyName,
      contactName: row.contactName,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      relationshipTier: row.relationshipTier
        ? { id: row.relationshipTier.id, name: row.relationshipTier.name }
        : null,
      sequenceId: row.sequenceId,
      paymentTerms: row.paymentTerms,
      avgDaysToPay: row.avgDaysToPay === null ? null : Number(row.avgDaysToPay),
      totalOutstanding: row.totalOutstanding,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
