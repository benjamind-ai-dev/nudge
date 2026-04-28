import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import type { Prisma } from "@nudge/database";
import { STOPPED_REASONS } from "@nudge/shared";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type { PrismaTransactionClient } from "../../../common/database/prisma-tx";
import type {
  ApplyChangeResult,
  InvoiceChange,
  InvoiceRepository,
  LocalInvoiceSnapshot,
  SequenceRunRepository,
} from "../domain/repositories";
import { SEQUENCE_RUN_REPOSITORY } from "../domain/repositories";
import type {
  InvoiceStatus,
  PriorInvoiceState,
} from "../domain/canonical-invoice";

@Injectable()
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    @Inject(SEQUENCE_RUN_REPOSITORY)
    private readonly sequenceRuns: SequenceRunRepository,
  ) {}

  async findPriorStatesByExternalIds(
    businessId: string,
    externalIds: string[],
  ): Promise<Map<string, PriorInvoiceState>> {
    if (externalIds.length === 0) return new Map();
    const rows = await this.prisma.invoice.findMany({
      where: { businessId, externalId: { in: externalIds } },
      select: { externalId: true, status: true, balanceDueCents: true },
    });
    return new Map(
      rows.map((r) => [
        r.externalId,
        {
          status: r.status as InvoiceStatus,
          balanceDueCents: r.balanceDueCents,
        },
      ]),
    );
  }

  async findLocalSnapshotForVoid(
    businessId: string,
    externalId: string,
  ): Promise<LocalInvoiceSnapshot | null> {
    const row = await this.prisma.invoice.findFirst({
      where: { businessId, externalId },
      select: {
        invoiceNumber: true,
        amountCents: true,
        amountPaidCents: true,
        currency: true,
        paymentLinkUrl: true,
        issuedDate: true,
        dueDate: true,
        customer: { select: { externalId: true } },
      },
    });
    if (!row) return null;
    return {
      invoiceNumber: row.invoiceNumber,
      customerExternalId: row.customer.externalId,
      amountCents: row.amountCents,
      amountPaidCents: row.amountPaidCents,
      currency: row.currency,
      paymentLinkUrl: row.paymentLinkUrl,
      issuedDate: row.issuedDate,
      dueDate: row.dueDate,
    };
  }

  async applyChange(
    businessId: string,
    change: InvoiceChange,
  ): Promise<ApplyChangeResult> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Resolve customer.id (atomic with the rest of the writes).
      const customer = await tx.customer.findFirst({
        where: { businessId, externalId: change.customerExternalId },
        select: { id: true },
      });
      if (!customer) {
        throw new Error(
          `Invoice ${change.externalId} references customer ` +
            `${change.customerExternalId} which is not persisted; ` +
            "customers must be upserted before invoices.",
        );
      }

      // 2. Upsert the invoice (this also covers the no_change case via
      //    last_synced_at bump, and the new_invoice case via insert).
      const invoiceRow = await this.upsertOne(
        tx,
        businessId,
        customer.id,
        change,
      );

      // 3. Side effects: customer balance + sequence stop.
      const stoppedSequenceRunIds = await this.applyTransitionSideEffects(
        tx,
        invoiceRow.id,
        customer.id,
        change,
      );

      return { invoiceId: invoiceRow.id, stoppedSequenceRunIds };
    });
  }

  private async upsertOne(
    tx: PrismaTransactionClient,
    businessId: string,
    customerId: string,
    change: InvoiceChange,
  ): Promise<{ id: string }> {
    const inv = change.invoice;
    const setPaidAt = change.transition.kind === "fully_paid";

    const createData = {
      businessId,
      customerId,
      externalId: change.externalId,
      invoiceNumber: inv.invoiceNumber,
      amountCents: inv.amountCents,
      amountPaidCents: inv.amountPaidCents,
      balanceDueCents: inv.balanceDueCents,
      currency: inv.currency,
      paymentLinkUrl: inv.paymentLinkUrl,
      issuedDate: inv.issuedDate,
      dueDate: inv.dueDate,
      status: change.newStatus,
      provider: change.provider,
      paidAt: setPaidAt ? change.lastSyncedAt : null,
      lastSyncedAt: change.lastSyncedAt,
    };

    const updateData: Prisma.InvoiceUpdateInput = {
      customer: { connect: { id: customerId } },
      invoiceNumber: inv.invoiceNumber,
      amountCents: inv.amountCents,
      amountPaidCents: inv.amountPaidCents,
      balanceDueCents: inv.balanceDueCents,
      currency: inv.currency,
      paymentLinkUrl: inv.paymentLinkUrl,
      issuedDate: inv.issuedDate,
      dueDate: inv.dueDate,
      status: change.newStatus,
      provider: change.provider,
      lastSyncedAt: change.lastSyncedAt,
    };
    // paid_at is only stamped on the fully_paid transition; omitting it from
    // updates prevents re-syncs from clobbering the original transition date.
    if (setPaidAt) updateData.paidAt = change.lastSyncedAt;

    return tx.invoice.upsert({
      where: {
        businessId_externalId: { businessId, externalId: change.externalId },
      },
      create: createData,
      update: updateData,
      select: { id: true },
    });
  }

  private async applyTransitionSideEffects(
    tx: PrismaTransactionClient,
    invoiceId: string,
    customerId: string,
    change: InvoiceChange,
  ): Promise<string[]> {
    const t = change.transition;
    switch (t.kind) {
      case "no_change":
        return [];

      case "new_invoice": {
        // Add the invoice's balance to the customer total only if the new row
        // is in a contributing status (open/overdue/partial). Paid/voided new
        // invoices contribute nothing.
        const contributes =
          change.newStatus === "open" ||
          change.newStatus === "overdue" ||
          change.newStatus === "partial";
        if (contributes && change.invoice.balanceDueCents > 0) {
          await tx.customer.update({
            where: { id: customerId },
            data: {
              totalOutstanding: {
                increment: change.invoice.balanceDueCents,
              },
            },
          });
        }
        return [];
      }

      case "balance_changed":
      case "partial_payment": {
        const delta = t.newBalance - t.priorBalance;
        if (delta !== 0) {
          await tx.customer.update({
            where: { id: customerId },
            data: { totalOutstanding: { increment: delta } },
          });
        }
        return [];
      }

      case "fully_paid": {
        const stopped = await this.sequenceRuns.stopActiveRunsForInvoice(
          tx,
          invoiceId,
          STOPPED_REASONS.PAYMENT_RECEIVED,
          change.lastSyncedAt,
        );
        if (t.priorBalance > 0) {
          await tx.customer.update({
            where: { id: customerId },
            data: { totalOutstanding: { decrement: t.priorBalance } },
          });
        }
        return stopped;
      }

      case "voided": {
        const stopped = await this.sequenceRuns.stopActiveRunsForInvoice(
          tx,
          invoiceId,
          STOPPED_REASONS.INVOICE_VOIDED,
          change.lastSyncedAt,
        );
        if (t.priorBalance > 0) {
          await tx.customer.update({
            where: { id: customerId },
            data: { totalOutstanding: { decrement: t.priorBalance } },
          });
        }
        return stopped;
      }
    }
  }
}
