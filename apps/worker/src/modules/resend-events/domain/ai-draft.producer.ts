export interface AiDraftProducer {
  enqueue(messageId: string, businessId: string): Promise<void>;
}

export const AI_DRAFT_PRODUCER = Symbol("ResendEventsAiDraftProducer");
