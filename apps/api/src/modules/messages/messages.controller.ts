import {
  BadGatewayException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import { CallerNotProvisionedError } from "../../common/auth-context/business-authorization.errors";
import { BusinessNotFoundError } from "../business/domain/business.errors";
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
    private readonly businessAuth: BusinessAuthorizationService,
  ) {}

  @Get()
  async list(
    @AccountId() clerkUserId: string,
    @Query(new ZodValidationPipe(listMessagesQuerySchema)) query: ListMessagesQuery,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
      return this.listMessages.execute(query);
    } catch (error) {
      if (error instanceof BusinessNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof CallerNotProvisionedError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  @Get(":id")
  async get(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(getMessageQuerySchema)) query: GetMessageQuery,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
      const data = await this.getMessage.execute(id, query.businessId);
      return { data };
    } catch (error) {
      if (error instanceof MessageNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      throw error;
    }
  }

  @Post(":id/send-reply")
  @HttpCode(200)
  async reply(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(getMessageQuerySchema)) query: GetMessageQuery,
    @Body(new ZodValidationPipe(sendReplyBodySchema)) body: SendReplyBody,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
      const data = await this.sendReply.execute(id, query.businessId, body);
      return { data };
    } catch (error) {
      if (error instanceof MessageNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof NoReplyToRespondToError) throw new ConflictException(error.message);
      if (error instanceof CustomerHasNoEmailError) throw new UnprocessableEntityException(error.message);
      if (error instanceof OutboundEmailSendError) throw new BadGatewayException(error.message);
      throw error;
    }
  }
}
