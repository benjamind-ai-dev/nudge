import {
  Controller,
  Post,
  Req,
  Headers,
  Logger,
  HttpCode,
  RawBodyRequest,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";
import { Request } from "express";
import { Env } from "../../common/config/env.schema";

@Controller("v1/webhooks/xero")
export class XeroWebhookController {
  private readonly logger = new Logger(XeroWebhookController.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  @Post()
  @HttpCode(200)
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-xero-signature") signature: string | undefined,
  ): void {
    const webhookKey = this.config.get("XERO_WEBHOOK_KEY", { infer: true });

    if (!webhookKey || !signature || !req.rawBody) {
      throw new UnauthorizedException();
    }

    const hash = createHmac("sha256", webhookKey)
      .update(req.rawBody)
      .digest("base64");

    const hashBuffer = Buffer.from(hash);
    const signatureBuffer = Buffer.from(signature);

    if (
      hashBuffer.length !== signatureBuffer.length ||
      !timingSafeEqual(hashBuffer, signatureBuffer)
    ) {
      throw new UnauthorizedException();
    }

    this.logger.log({ msg: "Xero webhook received and validated" });
  }
}
