import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  type ResendEventsMessageRepository,
  RESEND_EVENTS_MESSAGE_REPOSITORY,
} from "../domain/resend-events-message.repository";

export interface HandleEmailFailedInput {
  externalMessageId: string;
}

@Injectable()
export class HandleEmailFailedUseCase {
  private readonly logger = new Logger(HandleEmailFailedUseCase.name);

  constructor(
    @Inject(RESEND_EVENTS_MESSAGE_REPOSITORY)
    private readonly messageRepo: ResendEventsMessageRepository,
  ) {}

  async execute(input: HandleEmailFailedInput): Promise<void> {
    const message = await this.messageRepo.findByExternalId(input.externalMessageId);

    if (!message) {
      this.logger.warn({
        msg: "No message found for Resend external ID — skipping failed event",
        externalMessageId: input.externalMessageId,
      });
      return;
    }

    await this.messageRepo.updateStatus(message.id, message.businessId, "failed");

    this.logger.log({
      msg: "Message marked as failed",
      messageId: message.id,
      externalMessageId: input.externalMessageId,
    });
  }
}
