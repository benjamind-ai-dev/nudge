import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import type { Prisma } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  InvoiceRepository,
  InvoiceUpsertRow,
} from "../domain/repositories";
import type { InvoiceStatus } from "../domain/canonical-invoice";

@Injectable()
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async findStatusesByExternalIds(
    businessId: string,
    externalIds: string[],
  ): Promise<Map<string, InvoiceStatus>> {
    if (externalIds.length === 0) return new Map();
    const rows = await this.prisma.invoice.findMany({
      where: { businessId, externalId: { in: externalIds } },
      select: { externalId: true, status: true },
    });
    return new Map(rows.map((r) => [r.externalId, r.status as InvoiceStatus]));
  }

  async upsertMany(
    businessId: string,
    rows: InvoiceUpsertRow[],
  ): Promise<void> {
    if (rows.length === 0) return;

    const customerExtIds = Array.from(
      new Set(rows.map((r) => r.customerExternalId)),
    );
    const customers = await this.prisma.customer.findMany({
      where: { businessId, externalId: { in: customerExtIds } },
      select: { id: true, externalId: true },
    });
    const customerIdByExtId = new Map(
      customers.map((c) => [c.externalId, c.id]),
    );

    await this.prisma.$transaction(
      rows.map((r) => {
        const customerId = customerIdByExtId.get(r.customerExternalId);
        if (!customerId) {
          throw new Error(
            `Invoice ${r.externalId} references customer ${r.customerExternalId} ` +
              `which was not present in the customer page — provider data inconsistency`,
          );
        }
        const createData = {
          businessId,
          customerId,
          externalId: r.externalId,
          invoiceNumber: r.invoiceNumber,
          amountCents: r.amountCents,
          amountPaidCents: r.amountPaidCents,
          balanceDueCents: r.balanceDueCents,
          currency: r.currency,
          paymentLinkUrl: r.paymentLinkUrl,
          issuedDate: r.issuedDate,
          dueDate: r.dueDate,
          status: r.status,
          provider: r.provider,
          paidAt: r.paidAtIfNewlyPaid ?? null,
          lastSyncedAt: r.lastSyncedAt,
        };
        const updateData: Prisma.InvoiceUpdateInput = {
          customer: { connect: { id: customerId } },
          invoiceNumber: r.invoiceNumber,
          amountCents: r.amountCents,
          amountPaidCents: r.amountPaidCents,
          balanceDueCents: r.balanceDueCents,
          currency: r.currency,
          paymentLinkUrl: r.paymentLinkUrl,
          issuedDate: r.issuedDate,
          dueDate: r.dueDate,
          status: r.status,
          provider: r.provider,
          lastSyncedAt: r.lastSyncedAt,
        };
        // paidAt is only stamped on the open/overdue → paid transition; omitting it
        // from update prevents re-syncs from clobbering the original transition date.
        if (r.paidAtIfNewlyPaid) updateData.paidAt = r.paidAtIfNewlyPaid;

        return this.prisma.invoice.upsert({
          where: {
            businessId_externalId: {
              businessId,
              externalId: r.externalId,
            },
          },
          create: createData,
          update: updateData,
        });
      }),
    );
  }
}
