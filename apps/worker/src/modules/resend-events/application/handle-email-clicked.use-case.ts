import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  type ResendEventsMessageRepository,
  RESEND_EVENTS_MESSAGE_REPOSITORY,
} from "../domain/resend-events-message.repository";

export interface HandleEmailClickedInput {
  externalMessageId: string;
  clickedAt: Date;
}

@Injectable()
export class HandleEmailClickedUseCase {
  private readonly logger = new Logger(HandleEmailClickedUseCase.name);

  constructor(
    @Inject(RESEND_EVENTS_MESSAGE_REPOSITORY)
    private readonly messageRepo: ResendEventsMessageRepository,
  ) {}

  async execute(input: HandleEmailClickedInput): Promise<void> {
    const message = await this.messageRepo.findByExternalId(input.externalMessageId);

    if (!message) {
      this.logger.warn({
        msg: "No message found for Resend external ID — skipping clicked event",
        externalMessageId: input.externalMessageId,
      });
      return;
    }

    await this.messageRepo.updateClickedAt(message.id, message.businessId, input.clickedAt);

    this.logger.log({
      msg: "Message click recorded",
      messageId: message.id,
      externalMessageId: input.externalMessageId,
    });
  }
}
