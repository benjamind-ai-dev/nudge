import { Module } from "@nestjs/common";
import { MESSAGE_REPOSITORY } from "./domain/message.repository";
import { OUTBOUND_EMAIL_SERVICE } from "./domain/outbound-email.service";
import { PrismaMessageRepository } from "./infrastructure/prisma-message.repository";
import { ResendOutboundEmailService } from "./infrastructure/resend-outbound-email.service";
import { ListMessagesUseCase } from "./application/list-messages.use-case";
import { GetMessageUseCase } from "./application/get-message.use-case";
import { SendReplyUseCase } from "./application/send-reply.use-case";
import { MessagesController } from "./messages.controller";

@Module({
  controllers: [MessagesController],
  providers: [
    ListMessagesUseCase,
    GetMessageUseCase,
    SendReplyUseCase,
    { provide: MESSAGE_REPOSITORY, useClass: PrismaMessageRepository },
    { provide: OUTBOUND_EMAIL_SERVICE, useClass: ResendOutboundEmailService },
  ],
})
export class MessagesModule {}
