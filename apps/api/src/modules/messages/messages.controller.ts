import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ListMessagesUseCase } from "./application/list-messages.use-case";
import { GetMessageUseCase } from "./application/get-message.use-case";
import { MessageNotFoundError } from "./domain/message.errors";
import {
  getMessageQuerySchema,
  listMessagesQuerySchema,
  type GetMessageQuery,
  type ListMessagesQuery,
} from "./dto/messages.dto";

@Controller("v1/messages")
export class MessagesController {
  constructor(
    private readonly listMessages: ListMessagesUseCase,
    private readonly getMessage: GetMessageUseCase,
  ) {}

  @Get()
  async list(
    @AccountId() _accountId: string,
    @Query(new ZodValidationPipe(listMessagesQuerySchema)) query: ListMessagesQuery,
  ) {
    return this.listMessages.execute(query);
  }

  @Get(":id")
  async get(
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(getMessageQuerySchema)) query: GetMessageQuery,
  ) {
    try {
      const data = await this.getMessage.execute(id, query.businessId);
      return { data };
    } catch (error) {
      if (error instanceof MessageNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
