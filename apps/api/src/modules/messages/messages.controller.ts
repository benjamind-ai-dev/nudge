import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import { ListMessagesUseCase } from "./application/list-messages.use-case";
import { GetMessageUseCase } from "./application/get-message.use-case";
import { SendReplyUseCase } from "./application/send-reply.use-case";
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
    private readonly businessAuth: BusinessAuthorizationService,
  ) {}

  @Get()
  async list(
    @AccountId() clerkUserId: string,
    @Query(new ZodValidationPipe(listMessagesQuerySchema)) query: ListMessagesQuery,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
    return this.listMessages.execute(query);
  }

  @Get(":id")
  async get(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(getMessageQuerySchema)) query: GetMessageQuery,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
    const data = await this.getMessage.execute(id, query.businessId);
    return { data };
  }

  @Post(":id/send-reply")
  @HttpCode(200)
  async reply(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(getMessageQuerySchema)) query: GetMessageQuery,
    @Body(new ZodValidationPipe(sendReplyBodySchema)) body: SendReplyBody,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
    const data = await this.sendReply.execute(id, query.businessId, body);
    return { data };
  }
}
