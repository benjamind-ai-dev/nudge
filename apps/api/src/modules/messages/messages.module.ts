import { Module } from "@nestjs/common";
import { MESSAGE_REPOSITORY } from "./domain/message.repository";
import { PrismaMessageRepository } from "./infrastructure/prisma-message.repository";
import { ListMessagesUseCase } from "./application/list-messages.use-case";
import { GetMessageUseCase } from "./application/get-message.use-case";
import { MessagesController } from "./messages.controller";

@Module({
  controllers: [MessagesController],
  providers: [
    ListMessagesUseCase,
    GetMessageUseCase,
    { provide: MESSAGE_REPOSITORY, useClass: PrismaMessageRepository },
  ],
})
export class MessagesModule {}
