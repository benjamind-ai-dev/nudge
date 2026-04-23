import type { MessageSendJobData } from "@nudge/shared";

export interface EnqueueOptions {
  attempts: number;
  backoff: {
    type: "exponential" | "fixed";
    delay: number;
  };
}

export interface MessageQueueService {
  enqueueSendMessage(data: MessageSendJobData, options: EnqueueOptions): Promise<void>;
}

export const MESSAGE_QUEUE_SERVICE = Symbol("MessageQueueService");
