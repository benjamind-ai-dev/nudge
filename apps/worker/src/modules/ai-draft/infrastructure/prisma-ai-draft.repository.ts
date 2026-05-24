import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  AiDraftMessageContext,
  AiDraftRepository,
} from "../application/ports/ai-draft.repository";

@Injectable()
export class PrismaAiDraftRepository implements AiDraftRepository {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async findMessageContext(
    messageId: string,
    businessId: string,
  ): Promise<AiDraftMessageContext | null> {
    const row = await this.prisma.message.findFirst({
      where: { id: messageId, businessId },
      select: {
        id: true,
        body: true,
        replyBody: true,
        invoice: {
          select: {
            invoiceNumber: true,
            balanceDueCents: true,
            currency: true,
            dueDate: true,
            daysOverdue: true,
          },
        },
        customer: {
          select: { companyName: true, contactName: true },
        },
        business: {
          select: { senderName: true },
        },
      },
    });

    if (!row) return null;

    return {
      message: { id: row.id, body: row.body, replyBody: row.replyBody },
      invoice: {
        invoiceNumber: row.invoice.invoiceNumber,
        balanceDueCents: row.invoice.balanceDueCents,
        currency: row.invoice.currency,
        dueDate: row.invoice.dueDate,
        daysOverdue: row.invoice.daysOverdue,
      },
      customer: {
        companyName: row.customer.companyName,
        contactName: row.customer.contactName,
      },
      business: { senderName: row.business.senderName },
    };
  }

  async saveDraft(
    messageId: string,
    businessId: string,
    draft: string | null,
  ): Promise<void> {
    await this.prisma.message.updateMany({
      where: { id: messageId, businessId },
      data: { aiDraftResponse: draft },
    });
  }
}
