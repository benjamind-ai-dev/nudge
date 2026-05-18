import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ListMessagesUseCase } from "./application/list-messages.use-case";
import { GetMessageUseCase } from "./application/get-message.use-case";
import { SendReplyUseCase } from "./application/send-reply.use-case";
import {
  CustomerHasNoEmailError,
  MessageNotFoundError,
  NoReplyToRespondToError,
  OutboundEmailSendError,
} from "./domain/message.errors";
import {
  getMessageQuerySchema,
  listMessagesQuerySchema,
  sendReplyBodySchema,
  type GetMessageQuery,
  type ListMessagesQuery,
  type SendReplyBody,
} from "./dto/messages.dto";

@Controller("v1/messages")
export class MessagesController {
  constructor(
    private readonly listMessages: ListMessagesUseCase,
    private readonly getMessage: GetMessageUseCase,
    private readonly sendReply: SendReplyUseCase,
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

  @Post(":id/send-reply")
  @HttpCode(200)
  async reply(
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(getMessageQuerySchema)) query: GetMessageQuery,
    @Body(new ZodValidationPipe(sendReplyBodySchema)) body: SendReplyBody,
  ) {
    try {
      const data = await this.sendReply.execute(id, query.businessId, body);
      return { data };
    } catch (error) {
      if (error instanceof MessageNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof NoReplyToRespondToError) throw new ConflictException(error.message);
      if (error instanceof CustomerHasNoEmailError) throw new UnprocessableEntityException(error.message);
      if (error instanceof OutboundEmailSendError) throw new HttpException(error.message, HttpStatus.BAD_GATEWAY);
      throw error;
    }
  }
}
