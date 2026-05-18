import { Inject, Injectable } from "@nestjs/common";
import { MESSAGE_REPOSITORY, type MessageListFilter, type MessageRepository } from "../domain/message.repository";
import type { MessageListItem } from "../domain/message.entity";

export interface ListMessagesResult {
  data: MessageListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class ListMessagesUseCase {
  constructor(
    @Inject(MESSAGE_REPOSITORY)
    private readonly repo: MessageRepository,
  ) {}

  async execute(filter: MessageListFilter): Promise<ListMessagesResult> {
    const { items, total } = await this.repo.findManyByFilter(filter);
    const totalPages = Math.max(1, Math.ceil(total / filter.limit));
    return {
      data: items,
      pagination: { page: filter.page, limit: filter.limit, total, totalPages },
    };
  }
}
