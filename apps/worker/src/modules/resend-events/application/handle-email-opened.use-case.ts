import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  type ResendEventsMessageRepository,
  RESEND_EVENTS_MESSAGE_REPOSITORY,
} from "../domain/resend-events-message.repository";

export interface HandleEmailOpenedInput {
  externalMessageId: string;
  openedAt: Date;
}

@Injectable()
export class HandleEmailOpenedUseCase {
  private readonly logger = new Logger(HandleEmailOpenedUseCase.name);

  constructor(
    @Inject(RESEND_EVENTS_MESSAGE_REPOSITORY)
    private readonly messageRepo: ResendEventsMessageRepository,
  ) {}

  async execute(input: HandleEmailOpenedInput): Promise<void> {
    const message = await this.messageRepo.findByExternalId(input.externalMessageId);

    if (!message) {
      this.logger.warn({
        msg: "No message found for Resend external ID — skipping opened event",
        externalMessageId: input.externalMessageId,
      });
      return;
    }

    await this.messageRepo.updateOpenedAt(message.id, message.businessId, input.openedAt);

    this.logger.log({
      msg: "Message open recorded",
      messageId: message.id,
      externalMessageId: input.externalMessageId,
    });
  }
}
