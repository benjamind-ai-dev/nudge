import { Inject, Injectable } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  MessageChannel,
  MessageDetail,
  MessageListItem,
} from "../domain/message.entity";
import type {
  CreateReplyMessageData,
  MessageListFilter,
  MessageListResult,
  MessageRepository,
  ReplyContext,
  UpdateMessageSentData,
} from "../domain/message.repository";

const LIST_SELECT = {
  id: true,
  channel: true,
  recipientEmail: true,
  recipientPhone: true,
  subject: true,
  status: true,
  sentAt: true,
  openedAt: true,
  clickedAt: true,
  repliedAt: true,
  customer: { select: { id: true, companyName: true } },
  invoice: { select: { id: true, invoiceNumber: true } },
} satisfies Prisma.MessageSelect;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  body: true,
  replyBody: true,
  aiDraftResponse: true,
  sequenceRun: { select: { id: true, status: true } },
  sequenceStep: { select: { stepOrder: true, subjectTemplate: true } },
} satisfies Prisma.MessageSelect;

type ListRow = Prisma.MessageGetPayload<{ select: typeof LIST_SELECT }>;
type DetailRow = Prisma.MessageGetPayload<{ select: typeof DETAIL_SELECT }>;

@Injectable()
export class PrismaMessageRepository implements MessageRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findManyByFilter(filter: MessageListFilter): Promise<MessageListResult> {
    const where = this.buildWhere(filter);
    const skip = (filter.page - 1) * filter.limit;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where,
        select: LIST_SELECT,
        orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: filter.limit,
      }),
      this.prisma.message.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toListItem(row)),
      total,
    };
  }

  async findDetailById(id: string, businessId: string): Promise<MessageDetail | null> {
    const row = await this.prisma.message.findFirst({
      where: { id, businessId },
      select: DETAIL_SELECT,
    });
    return row ? this.toDetail(row) : null;
  }

  async findReplyContext(id: string, businessId: string): Promise<ReplyContext | null> {
    const row = await this.prisma.message.findFirst({
      where: { id, businessId },
      select: {
        id: true,
        subject: true,
        sequenceRunId: true,
        customerId: true,
        invoiceId: true,
        businessId: true,
        repliedAt: true,
        customer: { select: { id: true, contactEmail: true } },
        business: {
          select: {
            senderName: true,
            emailSignature: true,
            timezone: true,
          },
        },
        sequenceRun: {
          select: {
            id: true,
            status: true,
            currentStepId: true,
            currentStep: { select: { delayDays: true } },
          },
        },
      },
    });

    if (!row) return null;

    return {
      message: {
        id: row.id,
        subject: row.subject,
        sequenceRunId: row.sequenceRunId,
        customerId: row.customerId,
        invoiceId: row.invoiceId,
        businessId: row.businessId,
        repliedAt: row.repliedAt,
      },
      customer: {
        id: row.customer.id,
        contactEmail: row.customer.contactEmail,
      },
      business: {
        senderName: row.business.senderName,
        emailSignature: row.business.emailSignature,
        timezone: row.business.timezone,
      },
      sequenceRun: {
        id: row.sequenceRun.id,
        status: row.sequenceRun.status,
        currentStepId: row.sequenceRun.currentStepId,
      },
      currentStep: row.sequenceRun.currentStep
        ? { delayDays: row.sequenceRun.currentStep.delayDays }
        : null,
    };
  }

  async createReplyMessage(data: CreateReplyMessageData): Promise<void> {
    await this.prisma.message.create({
      data: {
        id: data.id,
        sequenceRunId: data.sequenceRunId,
        sequenceStepId: null,
        invoiceId: data.invoiceId,
        customerId: data.customerId,
        businessId: data.businessId,
        channel: "email",
        recipientEmail: data.recipientEmail,
        recipientPhone: null,
        subject: data.subject,
        body: data.body,
        status: "queued",
        externalMessageId: null,
        sentAt: null,
      },
    });
  }

  async markMessageSent(data: UpdateMessageSentData): Promise<void> {
    await this.prisma.message.updateMany({
      where: { id: data.id, businessId: data.businessId },
      data: {
        status: "sent",
        externalMessageId: data.externalMessageId,
        sentAt: data.sentAt,
      },
    });
  }

  async resumeRun(runId: string, businessId: string, nextSendAt: Date): Promise<void> {
    await this.prisma.sequenceRun.updateMany({
      where: {
        id: runId,
        status: "paused",
        invoice: { businessId },
      },
      data: { status: "active", pausedReason: null, nextSendAt },
    });
  }

  private buildWhere(filter: MessageListFilter): Prisma.MessageWhereInput {
    const where: Prisma.MessageWhereInput = { businessId: filter.businessId };

    if (filter.customerId) where.customerId = filter.customerId;
    if (filter.invoiceId) where.invoiceId = filter.invoiceId;
    if (filter.sequenceRunId) where.sequenceRunId = filter.sequenceRunId;
    if (filter.channel) where.channel = filter.channel;
    if (filter.status) where.status = filter.status;

    if (filter.hasReply === true) where.repliedAt = { not: null };
    else if (filter.hasReply === false) where.repliedAt = null;

    if (filter.sentAfter || filter.sentBefore) {
      where.sentAt = {};
      if (filter.sentAfter) where.sentAt.gte = filter.sentAfter;
      if (filter.sentBefore) where.sentAt.lte = filter.sentBefore;
    }

    return where;
  }

  private toListItem(row: ListRow): MessageListItem {
    return {
      id: row.id,
      channel: row.channel as MessageChannel,
      recipientEmail: row.recipientEmail,
      recipientPhone: row.recipientPhone,
      subject: row.subject,
      status: row.status,
      sentAt: row.sentAt,
      openedAt: row.openedAt,
      clickedAt: row.clickedAt,
      repliedAt: row.repliedAt,
      hasReply: row.repliedAt !== null,
      customer: { id: row.customer.id, companyName: row.customer.companyName },
      invoice: { id: row.invoice.id, invoiceNumber: row.invoice.invoiceNumber },
    };
  }

  private toDetail(row: DetailRow): MessageDetail {
    return {
      ...this.toListItem(row),
      body: row.body,
      replyBody: row.replyBody,
      aiDraftResponse: row.aiDraftResponse,
      sequenceRun: { id: row.sequenceRun.id, status: row.sequenceRun.status },
      sequenceStep: row.sequenceStep ? this.deriveStep(row.sequenceStep) : null,
    };
  }

  private deriveStep(step: { stepOrder: number; subjectTemplate: string | null }): {
    stepOrder: number;
    name: string;
  } {
    const firstLine = step.subjectTemplate?.split("\n")[0]?.trim();
    const name = firstLine && firstLine.length > 0 ? firstLine : `Step ${step.stepOrder}`;
    return { stepOrder: step.stepOrder, name };
  }
}
