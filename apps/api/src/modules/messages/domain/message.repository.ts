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

export interface MessageRepository {
  findManyByFilter(filter: MessageListFilter): Promise<MessageListResult>;
  findDetailById(id: string, businessId: string): Promise<MessageDetail | null>;
}
