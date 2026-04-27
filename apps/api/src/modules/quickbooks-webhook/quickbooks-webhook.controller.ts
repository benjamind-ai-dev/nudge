import {
  Controller,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { ProcessQuickbooksWebhookUseCase } from "./application/process-quickbooks-webhook.use-case";
import { IntuitSignatureGuard } from "./infrastructure/intuit-signature.guard";

@Controller("v1/webhooks/quickbooks")
export class QuickbooksWebhookController {
  constructor(
    private readonly processWebhook: ProcessQuickbooksWebhookUseCase,
  ) {}

  @Post()
  @HttpCode(200)
  @UseGuards(IntuitSignatureGuard)
  async handle(@Req() req: RawBodyRequest<Request>): Promise<void> {
    await this.processWebhook.execute({
      rawBody: req.rawBody ?? Buffer.alloc(0),
    });
  }
}
