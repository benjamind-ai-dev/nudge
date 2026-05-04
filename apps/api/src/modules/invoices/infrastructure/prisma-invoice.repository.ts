import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type { InvoiceRepository } from "../domain/invoice.repository";
import type { Invoice, InvoiceStatus } from "../domain/invoice.entity";

@Injectable()
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findAllByBusiness(businessId: string): Promise<Invoice[]> {
    const rows = await this.prisma.invoice.findMany({
      where: { businessId },
      select: {
        id: true,
        businessId: true,
        invoiceNumber: true,
        customerId: true,
        status: true,
        amountCents: true,
        balanceDueCents: true,
        currency: true,
        daysOverdue: true,
        dueDate: true,
        issuedDate: true,
        createdAt: true,
        updatedAt: true,
        customer: { select: { companyName: true } },
      },
      orderBy: { dueDate: "desc" },
    });

    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: {
    id: string;
    businessId: string;
    invoiceNumber: string | null;
    customerId: string;
    status: string;
    amountCents: number;
    balanceDueCents: number;
    currency: string;
    daysOverdue: number;
    dueDate: Date;
    issuedDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
    customer: { companyName: string };
  }): Invoice {
    return {
      id: row.id,
      businessId: row.businessId,
      invoiceNumber: row.invoiceNumber,
      customerId: row.customerId,
      customerName: row.customer.companyName,
      status: row.status as InvoiceStatus,
      amountCents: row.amountCents,
      balanceDueCents: row.balanceDueCents,
      currency: row.currency,
      daysOverdue: row.daysOverdue,
      dueDate: row.dueDate,
      issuedDate: row.issuedDate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
