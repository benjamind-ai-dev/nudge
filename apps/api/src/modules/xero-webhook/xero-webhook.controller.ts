import {
  Controller,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { ProcessXeroWebhookUseCase } from "./application/process-xero-webhook.use-case";
import { XeroSignatureGuard } from "./infrastructure/xero-signature.guard";

@Controller("v1/webhooks/xero")
export class XeroWebhookController {
  constructor(
    private readonly processWebhook: ProcessXeroWebhookUseCase,
  ) {}

  @Post()
  @HttpCode(200)
  @UseGuards(XeroSignatureGuard)
  async handle(@Req() req: RawBodyRequest<Request>): Promise<void> {
    await this.processWebhook.execute({
      rawBody: req.rawBody ?? Buffer.alloc(0),
    });
  }
}
