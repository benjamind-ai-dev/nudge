import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type { RecentWinsRepository } from "../domain/recent-wins.repository";
import type { RecentWinItem } from "../domain/recent-win-item.entity";

interface Row {
  id: string;
  invoice_id: string;
  invoice_number: string | null;
  customer_id: string;
  customer_name: string;
  amount_cents: bigint;
  paid_at: Date;
}

@Injectable()
export class PrismaRecentWinsRepository implements RecentWinsRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async listItems(businessId: string, limit: number): Promise<RecentWinItem[]> {
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT
        i.id              AS id,
        i.id              AS invoice_id,
        i.invoice_number  AS invoice_number,
        c.id              AS customer_id,
        c.company_name    AS customer_name,
        i.amount_cents    AS amount_cents,
        i.paid_at         AS paid_at
      FROM invoices  i
      JOIN customers c ON c.id = i.customer_id
      WHERE i.business_id = ${businessId}::uuid
        AND i.status = 'paid'
        AND i.paid_at IS NOT NULL
      ORDER BY i.paid_at DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      id: r.id,
      invoiceId: r.invoice_id,
      invoiceNumber: r.invoice_number,
      customerId: r.customer_id,
      customerName: r.customer_name,
      amountCents: Number(r.amount_cents),
      paidAt: r.paid_at.toISOString(),
    }));
  }
}
