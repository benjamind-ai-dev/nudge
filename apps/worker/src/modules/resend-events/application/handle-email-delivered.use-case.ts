import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  type ResendEventsMessageRepository,
  RESEND_EVENTS_MESSAGE_REPOSITORY,
} from "../domain/resend-events-message.repository";

export interface HandleEmailDeliveredInput {
  externalMessageId: string;
}

@Injectable()
export class HandleEmailDeliveredUseCase {
  private readonly logger = new Logger(HandleEmailDeliveredUseCase.name);

  constructor(
    @Inject(RESEND_EVENTS_MESSAGE_REPOSITORY)
    private readonly messageRepo: ResendEventsMessageRepository,
  ) {}

  async execute(input: HandleEmailDeliveredInput): Promise<void> {
    const message = await this.messageRepo.findByExternalId(input.externalMessageId);

    if (!message) {
      this.logger.warn({
        msg: "No message found for Resend external ID — skipping delivered event",
        externalMessageId: input.externalMessageId,
      });
      return;
    }

    await this.messageRepo.updateStatus(message.id, message.businessId, "delivered");

    this.logger.log({
      msg: "Message marked as delivered",
      messageId: message.id,
      externalMessageId: input.externalMessageId,
    });
  }
}
