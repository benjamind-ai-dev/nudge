import {
  Controller,
  Post,
  Query,
  Body,
  Logger,
  UnauthorizedException,
  HttpCode,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Env } from "../../common/config/env.schema";
import { TwilioSignatureGuard } from "./infrastructure/twilio-signature.guard";
import { IngestTwilioInboundUseCase } from "./application/ingest-twilio-inbound.use-case";

@Controller("v1/webhooks/twilio")
export class TwilioWebhookController {
  private readonly logger = new Logger(TwilioWebhookController.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly ingestInbound: IngestTwilioInboundUseCase,
  ) {}

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

  @Post("inbound")
  @HttpCode(200)
  @UseGuards(TwilioSignatureGuard)
  async handleInbound(@Body() body: Record<string, string>): Promise<void> {
    const { MessageSid, From, To, Body: messageBody } = body;

    if (!MessageSid || !From) {
      this.logger.warn({
        msg: "Twilio inbound missing MessageSid or From — skipping",
        event: "twilio_inbound_missing_fields",
      });
      return;
    }

    await this.ingestInbound.execute({
      messageSid: MessageSid,
      from: From,
      to: To ?? "",
      body: messageBody ?? "",
    });
  }
}
