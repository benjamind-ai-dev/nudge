import { Inject, Injectable } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  InvoiceDetail,
  InvoiceListItem,
  InvoiceMessageDetail,
  InvoiceSequenceRunSummary,
  InvoiceSequenceStepDetail,
  InvoiceStatus,
} from "../domain/invoice.entity";
import type {
  InvoiceListFilter,
  InvoiceListResult,
  InvoicePaymentLinkContext,
  InvoiceRepository,
} from "../domain/invoice.repository";

const MESSAGES_LIMIT = 50;

// "Active" run for the list summary: status in (active, paused), most recent
// startedAt. We always take the single newest such row.
const LIST_SELECT = {
  id: true,
  invoiceNumber: true,
  reference: true,
  description: true,
  status: true,
  amountCents: true,
  amountPaidCents: true,
  balanceDueCents: true,
  currency: true,
  daysOverdue: true,
  dueDate: true,
  issuedDate: true,
  paymentLinkUrl: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: { id: true, companyName: true },
  },
  sequenceRuns: {
    where: { status: { in: ["active", "paused"] } },
    orderBy: { startedAt: "desc" },
    take: 1,
    select: {
      id: true,
      status: true,
      nextSendAt: true,
      currentStep: {
        select: {
          stepOrder: true,
          subjectTemplate: true,
        },
      },
    },
  },
} satisfies Prisma.InvoiceSelect;

const DETAIL_SELECT = {
  id: true,
  invoiceNumber: true,
  reference: true,
  description: true,
  status: true,
  amountCents: true,
  amountPaidCents: true,
  balanceDueCents: true,
  currency: true,
  daysOverdue: true,
  dueDate: true,
  issuedDate: true,
  paidAt: true,
  paymentLinkUrl: true,
  aiPaymentScore: true,
  aiScoreReason: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: {
      id: true,
      companyName: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      paymentTerms: true,
    },
  },
  // Most recent run regardless of status; if it is stopped/completed we still
  // surface it so the user sees outcome history. The list endpoint uses a
  // narrower "active|paused" filter; the detail endpoint shows the latest.
  sequenceRuns: {
    orderBy: { startedAt: "desc" },
    take: 1,
    select: {
      id: true,
      status: true,
      pausedReason: true,
      stoppedReason: true,
      nextSendAt: true,
      startedAt: true,
      completedAt: true,
      currentStepId: true,
      sequence: {
        select: {
          id: true,
          name: true,
          steps: {
            orderBy: { stepOrder: "asc" },
            select: {
              id: true,
              stepOrder: true,
              delayDays: true,
              channel: true,
              subjectTemplate: true,
            },
          },
        },
      },
      messages: {
        select: { sequenceStepId: true },
      },
    },
  },
  messages: {
    orderBy: [
      { sentAt: { sort: "desc", nulls: "last" } },
      { id: "desc" },
    ],
    take: MESSAGES_LIMIT,
    select: {
      id: true,
      channel: true,
      subject: true,
      status: true,
      sentAt: true,
      openedAt: true,
      clickedAt: true,
      repliedAt: true,
      replyBody: true,
      aiDraftResponse: true,
    },
  },
} satisfies Prisma.InvoiceSelect;

type ListRow = Prisma.InvoiceGetPayload<{ select: typeof LIST_SELECT }>;
type DetailRow = Prisma.InvoiceGetPayload<{ select: typeof DETAIL_SELECT }>;

@Injectable()
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findManyByFilter(
    filter: InvoiceListFilter,
  ): Promise<InvoiceListResult> {
    const where = this.buildWhere(filter);
    const orderBy = this.buildOrderBy(filter);

    // Fetch one extra row to detect whether another page exists.
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        select: LIST_SELECT,
        orderBy,
        take: filter.limit + 1,
        ...(filter.cursor
          ? { cursor: { id: filter.cursor }, skip: 1 }
          : {}),
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const hasMore = rows.length > filter.limit;
    const pageRows = hasMore ? rows.slice(0, filter.limit) : rows;
    const nextCursor = hasMore ? pageRows[pageRows.length - 1].id : null;

    return {
      items: pageRows.map((row) => this.toListItem(row)),
      total,
      nextCursor,
    };
  }

  async findDetailById(
    id: string,
    businessId: string,
  ): Promise<InvoiceDetail | null> {
    const row = await this.prisma.invoice.findFirst({
      where: { id, businessId },
      select: DETAIL_SELECT,
    });
    return row ? this.toDetail(row) : null;
  }

  async findForPaymentLink(
    id: string,
    businessId: string,
  ): Promise<InvoicePaymentLinkContext | null> {
    const row = await this.prisma.invoice.findFirst({
      where: { id, businessId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        balanceDueCents: true,
        paymentLinkUrl: true,
        customer: { select: { companyName: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      status: row.status as InvoiceStatus,
      balanceDueCents: row.balanceDueCents,
      paymentLinkUrl: row.paymentLinkUrl,
      customer: { companyName: row.customer.companyName },
    };
  }

  async updatePaymentLinkUrl(
    id: string,
    businessId: string,
    paymentLinkUrl: string,
  ): Promise<void> {
    await this.prisma.invoice.updateMany({
      where: { id, businessId },
      data: { paymentLinkUrl },
    });
  }

  private buildWhere(filter: InvoiceListFilter): Prisma.InvoiceWhereInput {
    const where: Prisma.InvoiceWhereInput = { businessId: filter.businessId };

    if (filter.status) where.status = filter.status;
    if (filter.customerId) where.customerId = filter.customerId;

    if (filter.minAmount !== undefined || filter.maxAmount !== undefined) {
      where.amountCents = {
        ...(filter.minAmount !== undefined ? { gte: filter.minAmount } : {}),
        ...(filter.maxAmount !== undefined ? { lte: filter.maxAmount } : {}),
      };
    }

    if (filter.dueBefore !== undefined || filter.dueAfter !== undefined) {
      where.dueDate = {
        ...(filter.dueAfter !== undefined ? { gte: filter.dueAfter } : {}),
        ...(filter.dueBefore !== undefined ? { lte: filter.dueBefore } : {}),
      };
    }

    return where;
  }

  private buildOrderBy(
    filter: InvoiceListFilter,
  ): Prisma.InvoiceOrderByWithRelationInput[] {
    const order = filter.sortOrder;
    const primary: Prisma.InvoiceOrderByWithRelationInput =
      filter.sortBy === "due_date"
        ? { dueDate: order }
        : filter.sortBy === "amount_cents"
          ? { amountCents: order }
          : filter.sortBy === "days_overdue"
            ? { daysOverdue: order }
            : filter.sortBy === "paid_at"
              ? { paidAt: order }
              : filter.sortBy === "customer_name"
                ? { customer: { companyName: order } }
                : { status: order };

    // Always tie-break on id desc so pagination is deterministic.
    return [primary, { id: "desc" }];
  }

  private toListItem(row: ListRow): InvoiceListItem {
    const run = row.sequenceRuns[0];
    const sequenceRun: InvoiceSequenceRunSummary | null = run
      ? {
          id: run.id,
          status: run.status as "active" | "paused",
          nextSendAt: run.nextSendAt,
          currentStep: run.currentStep
            ? {
                stepOrder: run.currentStep.stepOrder,
                name:
                  run.currentStep.subjectTemplate ??
                  `Step ${run.currentStep.stepOrder}`,
              }
            : null,
        }
      : null;

    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      reference: row.reference,
      description: row.description,
      status: row.status as InvoiceStatus,
      amountCents: row.amountCents,
      amountPaidCents: row.amountPaidCents,
      balanceDueCents: row.balanceDueCents,
      currency: row.currency,
      daysOverdue: row.daysOverdue,
      dueDate: row.dueDate,
      issuedDate: row.issuedDate,
      paymentLinkUrl: row.paymentLinkUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      customer: { id: row.customer.id, companyName: row.customer.companyName },
      sequenceRun,
    };
  }

  private toDetail(row: DetailRow): InvoiceDetail {
    const run = row.sequenceRuns[0];

    const messages: InvoiceMessageDetail[] = row.messages.map((m) => ({
      id: m.id,
      channel: m.channel as "email" | "sms",
      subject: m.subject,
      status: m.status,
      sentAt: m.sentAt,
      openedAt: m.openedAt,
      clickedAt: m.clickedAt,
      repliedAt: m.repliedAt,
      replyBody: m.replyBody,
      aiDraftResponse: m.aiDraftResponse,
    }));

    const sequenceRun = run
      ? {
          id: run.id,
          status: run.status as
            | "active"
            | "paused"
            | "stopped"
            | "completed",
          pausedReason: run.pausedReason,
          stoppedReason: run.stoppedReason,
          nextSendAt: run.nextSendAt,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          sequence: { id: run.sequence.id, name: run.sequence.name },
          steps: this.deriveSteps(
            run.sequence.steps,
            run.currentStepId,
            new Set(
              run.messages
                .map((m) => m.sequenceStepId)
                .filter((id): id is string => id !== null),
            ),
          ),
        }
      : null;

    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      reference: row.reference,
      description: row.description,
      status: row.status as InvoiceStatus,
      amountCents: row.amountCents,
      amountPaidCents: row.amountPaidCents,
      balanceDueCents: row.balanceDueCents,
      currency: row.currency,
      daysOverdue: row.daysOverdue,
      dueDate: row.dueDate,
      issuedDate: row.issuedDate,
      paidAt: row.paidAt,
      paymentLinkUrl: row.paymentLinkUrl,
      aiPaymentScore: row.aiPaymentScore,
      aiScoreReason: row.aiScoreReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      customer: {
        id: row.customer.id,
        companyName: row.customer.companyName,
        contactName: row.customer.contactName,
        contactEmail: row.customer.contactEmail,
        contactPhone: row.customer.contactPhone,
        paymentTerms: row.customer.paymentTerms,
      },
      sequenceRun,
      messages,
    };
  }

  private deriveSteps(
    steps: {
      id: string;
      stepOrder: number;
      delayDays: number;
      channel: string;
      subjectTemplate: string | null;
    }[],
    currentStepId: string | null,
    messageStepIds: Set<string>,
  ): InvoiceSequenceStepDetail[] {
    return steps.map((step) => ({
      id: step.id,
      stepOrder: step.stepOrder,
      delayDays: step.delayDays,
      channel: step.channel as "email" | "sms" | "email_and_sms",
      name: step.subjectTemplate ?? `Step ${step.stepOrder}`,
      state: messageStepIds.has(step.id)
        ? "completed"
        : step.id === currentStepId
          ? "current"
          : "upcoming",
    }));
  }
}
