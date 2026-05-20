import { Inject, Injectable } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  SequenceRunDetail,
  SequenceRunListItem,
  SequenceRunStatus,
  SequenceStepDetail,
  StepChannel,
  SequenceRunMessageDetail,
} from "../domain/sequence-run.entity";
import type {
  SequenceRunActionContext,
  SequenceRunListFilter,
  SequenceRunListResult,
  SequenceRunRepository,
} from "../domain/sequence-run.repository";

const REPLY_SNIPPET_LENGTH = 100;

const LIST_SELECT = {
  id: true,
  status: true,
  pausedReason: true,
  stoppedReason: true,
  nextSendAt: true,
  startedAt: true,
  completedAt: true,
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      amountCents: true,
      balanceDueCents: true,
      businessId: true,
    },
  },
  currentStep: {
    select: { stepOrder: true, channel: true },
  },
} satisfies Prisma.SequenceRunSelect;

const DETAIL_SELECT = {
  id: true,
  status: true,
  pausedReason: true,
  stoppedReason: true,
  nextSendAt: true,
  startedAt: true,
  completedAt: true,
  currentStepId: true,
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      amountCents: true,
      amountPaidCents: true,
      balanceDueCents: true,
      currency: true,
      dueDate: true,
      status: true,
      businessId: true,
      customer: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
        },
      },
    },
  },
  sequence: {
    select: {
      id: true,
      name: true,
      relationshipTier: { select: { name: true } },
      steps: {
        select: {
          id: true,
          stepOrder: true,
          delayDays: true,
          channel: true,
        },
        orderBy: { stepOrder: "asc" },
      },
    },
  },
  messages: {
    select: {
      id: true,
      sequenceStepId: true,
      channel: true,
      subject: true,
      status: true,
      sentAt: true,
      openedAt: true,
      clickedAt: true,
      repliedAt: true,
      replyBody: true,
    },
    orderBy: { sentAt: "asc" },
  },
} satisfies Prisma.SequenceRunSelect;

type ListRow = Prisma.SequenceRunGetPayload<{ select: typeof LIST_SELECT }>;
type DetailRow = Prisma.SequenceRunGetPayload<{ select: typeof DETAIL_SELECT }>;

@Injectable()
export class PrismaSequenceRunRepository implements SequenceRunRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findManyByFilter(filter: SequenceRunListFilter): Promise<SequenceRunListResult> {
    const where = this.buildWhere(filter);
    const skip = (filter.page - 1) * filter.limit;
    const orderBy = this.buildOrderBy(filter.status);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sequenceRun.findMany({
        where,
        select: LIST_SELECT,
        orderBy,
        skip,
        take: filter.limit,
      }),
      this.prisma.sequenceRun.count({ where }),
    ]);

    // Customer comes off invoice.customer, but is not directly on SequenceRun.
    // Fetch in a single batched query scoped to businessId.
    const invoiceIds = rows.map((r) => r.invoice.id);
    const customers = invoiceIds.length
      ? await this.prisma.invoice.findMany({
          where: { id: { in: invoiceIds }, businessId: filter.businessId },
          select: { id: true, customer: { select: { id: true, companyName: true } } },
        })
      : [];
    const customerByInvoiceId = new Map(
      customers.map((c) => [c.id, c.customer] as const),
    );

    return {
      items: rows.map((row) => this.toListItem(row, customerByInvoiceId)),
      total,
    };
  }

  async findDetailById(id: string, businessId: string): Promise<SequenceRunDetail | null> {
    const row = await this.prisma.sequenceRun.findFirst({
      where: { id, invoice: { businessId } },
      select: DETAIL_SELECT,
    });
    return row ? this.toDetail(row) : null;
  }

  async findActionContext(
    id: string,
    businessId: string,
  ): Promise<SequenceRunActionContext | null> {
    const row = await this.prisma.sequenceRun.findFirst({
      where: { id, invoice: { businessId } },
      select: {
        id: true,
        status: true,
        invoice: {
          select: {
            invoiceNumber: true,
            customer: { select: { companyName: true } },
            business: { select: { timezone: true } },
          },
        },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      status: row.status as SequenceRunStatus,
      invoice: {
        invoiceNumber: row.invoice.invoiceNumber,
        businessTimezone: row.invoice.business.timezone,
      },
      customer: { companyName: row.invoice.customer.companyName },
    };
  }

  async pause(id: string, businessId: string, pausedReason: string): Promise<boolean> {
    const result = await this.prisma.sequenceRun.updateMany({
      where: { id, status: "active", invoice: { businessId } },
      data: { status: "paused", pausedReason },
    });
    return result.count === 1;
  }

  async resume(id: string, businessId: string, nextSendAt: Date): Promise<boolean> {
    const result = await this.prisma.sequenceRun.updateMany({
      where: { id, status: "paused", invoice: { businessId } },
      data: { status: "active", pausedReason: null, nextSendAt },
    });
    return result.count === 1;
  }

  async stop(
    id: string,
    businessId: string,
    stoppedReason: string,
    completedAt: Date,
  ): Promise<boolean> {
    const result = await this.prisma.sequenceRun.updateMany({
      where: { id, status: { in: ["active", "paused"] }, invoice: { businessId } },
      data: { status: "stopped", stoppedReason, completedAt },
    });
    return result.count === 1;
  }

  private buildWhere(filter: SequenceRunListFilter): Prisma.SequenceRunWhereInput {
    // SequenceRun has no businessId column — we scope through invoice.businessId.
    const where: Prisma.SequenceRunWhereInput = {
      invoice: { businessId: filter.businessId },
    };

    if (filter.status) where.status = filter.status;
    if (filter.invoiceId) where.invoiceId = filter.invoiceId;
    if (filter.customerId) {
      where.invoice = { businessId: filter.businessId, customerId: filter.customerId };
    }

    return where;
  }

  private buildOrderBy(
    status: SequenceRunStatus | undefined,
  ): Prisma.SequenceRunOrderByWithRelationInput[] {
    // Default sort per spec:
    //   - completed/stopped → completedAt DESC
    //   - everything else (active/paused/no filter) → nextSendAt ASC
    if (status === "completed" || status === "stopped") {
      return [{ completedAt: "desc" }, { id: "desc" }];
    }
    return [{ nextSendAt: "asc" }, { id: "asc" }];
  }

  private toListItem(
    row: ListRow,
    customerByInvoiceId: Map<string, { id: string; companyName: string }>,
  ): SequenceRunListItem {
    const customer = customerByInvoiceId.get(row.invoice.id);
    return {
      id: row.id,
      status: row.status as SequenceRunStatus,
      pausedReason: row.pausedReason,
      stoppedReason: row.stoppedReason,
      nextSendAt: row.nextSendAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      invoice: {
        id: row.invoice.id,
        invoiceNumber: row.invoice.invoiceNumber,
        amountCents: row.invoice.amountCents,
        balanceDueCents: row.invoice.balanceDueCents,
      },
      customer: customer ?? { id: "", companyName: "" },
      currentStep: row.currentStep
        ? {
            stepOrder: row.currentStep.stepOrder,
            channel: row.currentStep.channel as StepChannel,
          }
        : null,
    };
  }

  private toDetail(row: DetailRow): SequenceRunDetail {
    const messageStepIds = new Set<string>(
      row.messages
        .map((m) => m.sequenceStepId)
        .filter((id): id is string => id !== null),
    );

    const steps: SequenceStepDetail[] = row.sequence.steps.map((step) => ({
      id: step.id,
      stepOrder: step.stepOrder,
      delayDays: step.delayDays,
      channel: step.channel as StepChannel,
      state: this.deriveStepState(step.id, row.currentStepId, messageStepIds),
    }));

    const messages: SequenceRunMessageDetail[] = row.messages.map((m) => ({
      id: m.id,
      channel: m.channel as "email" | "sms",
      subject: m.subject,
      status: m.status,
      sentAt: m.sentAt,
      openedAt: m.openedAt,
      clickedAt: m.clickedAt,
      repliedAt: m.repliedAt,
      replyBody: this.snippet(m.replyBody),
    }));

    return {
      id: row.id,
      status: row.status as SequenceRunStatus,
      pausedReason: row.pausedReason,
      stoppedReason: row.stoppedReason,
      nextSendAt: row.nextSendAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      invoice: {
        id: row.invoice.id,
        invoiceNumber: row.invoice.invoiceNumber,
        amountCents: row.invoice.amountCents,
        amountPaidCents: row.invoice.amountPaidCents,
        balanceDueCents: row.invoice.balanceDueCents,
        currency: row.invoice.currency,
        dueDate: row.invoice.dueDate,
        status: row.invoice.status,
      },
      customer: {
        id: row.invoice.customer.id,
        companyName: row.invoice.customer.companyName,
        contactName: row.invoice.customer.contactName,
        contactEmail: row.invoice.customer.contactEmail,
        contactPhone: row.invoice.customer.contactPhone,
      },
      sequence: {
        id: row.sequence.id,
        name: row.sequence.name,
        tierName: row.sequence.relationshipTier?.name ?? null,
      },
      steps,
      messages,
    };
  }

  private deriveStepState(
    stepId: string,
    currentStepId: string | null,
    messageStepIds: Set<string>,
  ): "completed" | "current" | "upcoming" {
    if (messageStepIds.has(stepId)) return "completed";
    if (stepId === currentStepId) return "current";
    return "upcoming";
  }

  private snippet(body: string | null): string | null {
    if (!body) return null;
    const trimmed = body.trim();
    if (trimmed.length === 0) return null;
    return trimmed.length <= REPLY_SNIPPET_LENGTH
      ? trimmed
      : `${trimmed.slice(0, REPLY_SNIPPET_LENGTH)}…`;
  }
}
