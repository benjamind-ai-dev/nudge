import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type { NeedsAttentionRepository } from "../domain/needs-attention.repository";
import type {
  NeedsAttentionItem,
  NeedsAttentionType,
} from "../domain/needs-attention-item.entity";

interface Row {
  id: string;
  type: NeedsAttentionType;
  invoice_id: string;
  invoice_number: string | null;
  customer_id: string;
  customer_name: string;
  amount_cents: bigint;
  balance_due_cents: bigint;
  days_overdue: number;
  occurred_at: Date;
  summary: string;
}

@Injectable()
export class PrismaNeedsAttentionRepository implements NeedsAttentionRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async listItems(businessId: string, limit: number): Promise<NeedsAttentionItem[]> {
    const rows = await this.prisma.$queryRaw<Row[]>`
      WITH
      replied AS (
        SELECT
          m.id                       AS id,
          'client_replied'           AS type,
          m.invoice_id               AS invoice_id,
          i.invoice_number           AS invoice_number,
          m.customer_id              AS customer_id,
          c.company_name             AS customer_name,
          i.amount_cents             AS amount_cents,
          i.balance_due_cents        AS balance_due_cents,
          i.days_overdue             AS days_overdue,
          m.replied_at               AS occurred_at,
          'Replied to a sequence message' AS summary
        FROM messages m
        JOIN invoices  i ON i.id = m.invoice_id
        JOIN customers c ON c.id = m.customer_id
        WHERE m.business_id = ${businessId}::uuid
          AND m.replied_at IS NOT NULL
      ),
      owner_alert AS (
        SELECT
          m.id                       AS id,
          'owner_alert_triggered'    AS type,
          m.invoice_id               AS invoice_id,
          i.invoice_number           AS invoice_number,
          m.customer_id              AS customer_id,
          c.company_name             AS customer_name,
          i.amount_cents             AS amount_cents,
          i.balance_due_cents        AS balance_due_cents,
          i.days_overdue             AS days_overdue,
          m.sent_at                  AS occurred_at,
          'Owner-alert step executed' AS summary
        FROM messages m
        JOIN sequence_steps s ON s.id = m.sequence_step_id
        JOIN invoices       i ON i.id = m.invoice_id
        JOIN customers      c ON c.id = m.customer_id
        WHERE m.business_id = ${businessId}::uuid
          AND s.is_owner_alert = true
          AND m.sent_at IS NOT NULL
      ),
      disputed AS (
        SELECT
          i.id                       AS id,
          'disputed'                 AS type,
          i.id                       AS invoice_id,
          i.invoice_number           AS invoice_number,
          c.id                       AS customer_id,
          c.company_name             AS customer_name,
          i.amount_cents             AS amount_cents,
          i.balance_due_cents        AS balance_due_cents,
          i.days_overdue             AS days_overdue,
          i.updated_at               AS occurred_at,
          'Disputed by customer'     AS summary
        FROM invoices  i
        JOIN customers c ON c.id = i.customer_id
        WHERE i.business_id = ${businessId}::uuid
          AND i.status = 'disputed'
      ),
      stale AS (
        SELECT
          i.id                       AS id,
          'stale_no_response'        AS type,
          i.id                       AS invoice_id,
          i.invoice_number           AS invoice_number,
          c.id                       AS customer_id,
          c.company_name             AS customer_name,
          i.amount_cents             AS amount_cents,
          i.balance_due_cents        AS balance_due_cents,
          i.days_overdue             AS days_overdue,
          i.updated_at               AS occurred_at,
          'No response after 90+ days overdue' AS summary
        FROM invoices  i
        JOIN customers c ON c.id = i.customer_id
        WHERE i.business_id = ${businessId}::uuid
          AND i.status IN ('open', 'overdue', 'partial')
          AND i.days_overdue >= 90
      ),
      all_items AS (
        SELECT * FROM replied
        UNION ALL
        SELECT * FROM owner_alert
        UNION ALL
        SELECT * FROM disputed
        UNION ALL
        SELECT * FROM stale
      ),
      ranked AS (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY invoice_id
            ORDER BY
              CASE type
                WHEN 'client_replied'        THEN 1
                WHEN 'owner_alert_triggered' THEN 2
                WHEN 'disputed'              THEN 3
                WHEN 'stale_no_response'     THEN 4
              END,
              occurred_at DESC
          ) AS rn
        FROM all_items
      )
      SELECT id::text, type, invoice_id::text, invoice_number, customer_id::text,
             customer_name, amount_cents, balance_due_cents, days_overdue,
             occurred_at, summary
      FROM ranked
      WHERE rn = 1
      ORDER BY occurred_at DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      invoiceId: r.invoice_id,
      invoiceNumber: r.invoice_number,
      customerId: r.customer_id,
      customerName: r.customer_name,
      amountCents: Number(r.amount_cents),
      balanceDueCents: Number(r.balance_due_cents),
      daysOverdue: r.days_overdue,
      occurredAt: r.occurred_at.toISOString(),
      summary: r.summary,
    }));
  }
}
