import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  DaysRecalcRepository,
  RecalcOutcome,
  TransitionedInvoice,
} from "../domain/days-recalc.repository";

interface TransitioningRow {
  id: string;
  invoice_number: string | null;
}

@Injectable()
export class PrismaDaysRecalcRepository implements DaysRecalcRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async recalculate(): Promise<RecalcOutcome> {
    return this.prisma.$transaction(async (tx) => {
      const transitioning = await tx.$queryRaw<TransitioningRow[]>`
        SELECT id, invoice_number
        FROM invoices
        WHERE status = 'open' AND CURRENT_DATE > due_date
      `;

      const updatedCount = await tx.$executeRaw`
        UPDATE invoices
        SET days_overdue = GREATEST(0, CURRENT_DATE - due_date),
            status = CASE
              WHEN status = 'open' AND CURRENT_DATE > due_date THEN 'overdue'
              ELSE status
            END,
            updated_at = NOW()
        WHERE status IN ('open', 'overdue', 'partial')
      `;

      return {
        updatedCount: Number(updatedCount),
        transitioned: transitioning.map((row) => ({
          invoiceId: row.id,
          invoiceNumber: row.invoice_number,
        })),
      };
    });
  }

  async findInvoicesWithoutActiveSequenceRun(
    invoiceIds: string[],
  ): Promise<TransitionedInvoice[]> {
    if (invoiceIds.length === 0) return [];

    const rows = await this.prisma.invoice.findMany({
      where: {
        id: { in: invoiceIds },
        sequenceRuns: {
          none: { status: { in: ["active", "paused"] } },
        },
      },
      select: { id: true, invoiceNumber: true },
    });

    return rows.map((row) => ({
      invoiceId: row.id,
      invoiceNumber: row.invoiceNumber,
    }));
  }
}
