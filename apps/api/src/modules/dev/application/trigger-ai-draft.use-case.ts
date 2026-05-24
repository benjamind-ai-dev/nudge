import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { BullmqAiDraftProducer } from "../../messages/infrastructure/bullmq-ai-draft.producer";
import {
  DEV_MESSAGE_REPLY_REPOSITORY,
  type DevMessageReplyRepository,
} from "../domain/dev-message-reply.repository";

export interface TriggerAiDraftResult {
  enqueued: true;
  messageId: string;
  jobId: string;
}

@Injectable()
export class TriggerAiDraftUseCase {
  constructor(
    @Inject(DEV_MESSAGE_REPLY_REPOSITORY)
    private readonly repo: DevMessageReplyRepository,
    private readonly aiDraftProducer: BullmqAiDraftProducer,
  ) {}

  async execute(messageId: string, replyBody: string): Promise<TriggerAiDraftResult> {
    const result = await this.repo.markReplied(messageId, replyBody);
    if (!result) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }
    await this.aiDraftProducer.enqueue(messageId, result.businessId);
    return {
      enqueued: true,
      messageId,
      jobId: `ai-draft:${messageId}`,
    };
  }
}
