import {
  Controller,
  Post,
  Query,
  Body,
  Logger,
  UnauthorizedException,
  HttpCode,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Env } from "../../common/config/env.schema";

@Controller("v1/webhooks/twilio")
export class TwilioWebhookController {
  private readonly logger = new Logger(TwilioWebhookController.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  @Post("status")
  @HttpCode(200)
  handleStatusCallback(
    @Query("secret") secret: string,
    @Query("businessId") businessId: string,
    @Query("invoiceId") invoiceId: string | undefined,
    @Query("sequenceStepId") sequenceStepId: string | undefined,
    @Body() body: Record<string, string>,
  ): void {
    const expectedSecret = this.config.get("TWILIO_WEBHOOK_SECRET", {
      infer: true,
    });

    if (!secret || secret !== expectedSecret) {
      throw new UnauthorizedException();
    }

    const { MessageSid, MessageStatus, To, ErrorCode } = body;

    this.logger.log({
      msg: "Twilio delivery status received",
      messageSid: MessageSid,
      status: MessageStatus,
      to: To,
      errorCode: ErrorCode ?? null,
      businessId,
      invoiceId: invoiceId ?? null,
      sequenceStepId: sequenceStepId ?? null,
    });
  }
}
