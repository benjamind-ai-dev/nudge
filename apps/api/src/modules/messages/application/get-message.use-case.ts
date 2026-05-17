import { Inject, Injectable } from "@nestjs/common";
import { MESSAGE_REPOSITORY, type MessageRepository } from "../domain/message.repository";
import type { MessageDetail } from "../domain/message.entity";
import { MessageNotFoundError } from "../domain/message.errors";

@Injectable()
export class GetMessageUseCase {
  constructor(
    @Inject(MESSAGE_REPOSITORY)
    private readonly repo: MessageRepository,
  ) {}

  async execute(id: string, businessId: string): Promise<MessageDetail> {
    const message = await this.repo.findDetailById(id, businessId);
    if (!message) throw new MessageNotFoundError(id);
    return message;
  }
}
