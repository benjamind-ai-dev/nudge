import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { randomUUID } from "crypto";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import {
  WeeklySummary,
  type WeeklySummaryStatus,
} from "../domain/weekly-summary.entity";
import type { WeeklySummaryRepository } from "../domain/weekly-summary.repository";

@Injectable()
export class PrismaWeeklySummaryRepository implements WeeklySummaryRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async insertPending(input: {
    businessId: string;
    weekStartsAt: string;
  }): Promise<WeeklySummary> {
    const id = randomUUID();
    await this.prisma.weeklySummary.create({
      data: {
        id,
        businessId: input.businessId,
        weekStartsAt: new Date(input.weekStartsAt),
        status: "pending",
        metrics: {},
      },
    });
    return WeeklySummary.create({
      id,
      businessId: input.businessId,
      weekStartsAt: input.weekStartsAt,
    });
  }

  async exists(businessId: string, weekStartsAt: string): Promise<boolean> {
    const row = await this.prisma.weeklySummary.findUnique({
      where: {
        businessId_weekStartsAt: {
          businessId,
          weekStartsAt: new Date(weekStartsAt),
        },
      },
      select: { id: true },
    });
    return !!row;
  }

  async save(summary: WeeklySummary): Promise<void> {
    const p = summary.props;
    await this.prisma.weeklySummary.update({
      where: { id: p.id },
      data: {
        status: p.status as WeeklySummaryStatus,
        aiParagraph: p.aiParagraph,
        aiModel: p.aiModel,
        aiInputTokens: p.aiInputTokens,
        aiOutputTokens: p.aiOutputTokens,
        metrics: p.metrics as never,
        recipientEmails: p.recipientEmails,
        resendMessageIds: p.resendMessageIds,
        errorMessage: p.errorMessage,
        sentAt: p.sentAt,
      },
    });
  }
}
