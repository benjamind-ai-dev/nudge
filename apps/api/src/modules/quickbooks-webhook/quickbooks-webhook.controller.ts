import {
  Controller,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { ProcessQuickbooksWebhookUseCase } from "./application/process-quickbooks-webhook.use-case";
import { IntuitSignatureGuard } from "./infrastructure/intuit-signature.guard";
import { RATE_LIMITS, RATE_LIMIT_NAMES } from "../../common/throttler/throttler-config";

@SkipThrottle({ [RATE_LIMIT_NAMES.DEFAULT]: true, [RATE_LIMIT_NAMES.AUTH]: true })
@Throttle({ [RATE_LIMIT_NAMES.WEBHOOKS]: RATE_LIMITS.WEBHOOKS })
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
