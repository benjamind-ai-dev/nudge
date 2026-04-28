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
  InvoiceUpsertRow,
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

  async markVoidedByExternalId(
    businessId: string,
    externalId: string,
  ): Promise<{ customerExternalId: string } | null> {
    const row = await this.prisma.invoice.findFirst({
      where: { businessId, externalId },
      select: {
        id: true,
        customer: { select: { externalId: true } },
      },
    });
    if (!row) return null;

    await this.prisma.invoice.update({
      where: { id: row.id },
      data: { status: "voided", lastSyncedAt: new Date() },
    });
    return { customerExternalId: row.customer.externalId };
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
