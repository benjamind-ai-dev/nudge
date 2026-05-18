import type { MessageChannel, MessageDetail, MessageListItem } from "./message.entity";

export const MESSAGE_REPOSITORY = Symbol("MessageRepository");

export interface MessageListFilter {
  businessId: string;
  page: number;
  limit: number;
  customerId?: string;
  invoiceId?: string;
  sequenceRunId?: string;
  channel?: MessageChannel;
  status?: string;
  hasReply?: boolean;
  sentAfter?: Date;
  sentBefore?: Date;
}

export interface MessageListResult {
  items: MessageListItem[];
  total: number;
}

export interface ReplyContext {
  message: {
    id: string;
    subject: string | null;
    sequenceRunId: string;
    customerId: string;
    invoiceId: string;
    businessId: string;
    repliedAt: Date | null;
  };
  customer: {
    id: string;
    contactEmail: string | null;
  };
  business: {
    senderName: string;
    emailSignature: string | null;
    timezone: string;
  };
  sequenceRun: {
    id: string;
    status: string;
    currentStepId: string | null;
  };
  currentStep: {
    delayDays: number;
  } | null;
}

export interface CreateReplyMessageData {
  id: string;
  sequenceRunId: string;
  invoiceId: string;
  customerId: string;
  businessId: string;
  recipientEmail: string;
  subject: string;
  body: string;
}

export interface UpdateMessageSentData {
  id: string;
  businessId: string;
  externalMessageId: string;
  sentAt: Date;
}

export interface MessageRepository {
  findManyByFilter(filter: MessageListFilter): Promise<MessageListResult>;
  findDetailById(id: string, businessId: string): Promise<MessageDetail | null>;
  findReplyContext(id: string, businessId: string): Promise<ReplyContext | null>;
  createReplyMessage(data: CreateReplyMessageData): Promise<void>;
  markMessageSent(data: UpdateMessageSentData): Promise<void>;
  resumeRun(runId: string, businessId: string, nextSendAt: Date): Promise<void>;
}
