import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { BullmqAiDraftProducer } from "../../messages/infrastructure/bullmq-ai-draft.producer";

export interface TriggerAiDraftResult {
  enqueued: true;
  messageId: string;
  jobId: string;
}

@Injectable()
export class TriggerAiDraftUseCase {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    private readonly aiDraftProducer: BullmqAiDraftProducer,
  ) {}

  async execute(messageId: string, replyBody: string): Promise<TriggerAiDraftResult> {
    // DEV-ONLY: Intentionally not scoped by businessId. This endpoint is
    // gated behind DevKeyGuard and exists solely to exercise the ai-draft
    // queue pipeline during development before the reply-detection feature
    // ships. Never expose this pattern in tenant-scoped production endpoints.
    const updated = await this.prisma.message.updateMany({
      where: { id: messageId },
      data: { replyBody, repliedAt: new Date() },
    });

    if (updated.count === 0) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    const row = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { businessId: true },
    });

    await this.aiDraftProducer.enqueue(messageId, row!.businessId);

    return {
      enqueued: true,
      messageId,
      jobId: `ai-draft:${messageId}`,
    };
  }
}
