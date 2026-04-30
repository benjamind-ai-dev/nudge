import { Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { IngestResendEventsUseCase } from "./application/ingest-resend-events.use-case";
import {
  ResendWebhookGuard,
  RESEND_EVENTS_KEY,
} from "./infrastructure/resend-webhook.guard";
import { DuplicateResendBatchError } from "./domain/resend-webhook.errors";

@Controller("v1/webhooks/resend")
export class ResendWebhookController {
  constructor(private readonly ingestEvents: IngestResendEventsUseCase) {}

  @Post("events")
  @HttpCode(200)
  @UseGuards(ResendWebhookGuard)
  async handle(
    @Req() req: RawBodyRequest<Request> & Record<string, unknown>,
  ): Promise<void> {
    const events = req[RESEND_EVENTS_KEY] as unknown[];

    try {
      await this.ingestEvents.execute({ events, rawBody: req.rawBody! });
    } catch (err) {
      if (err instanceof DuplicateResendBatchError) {
        return;
      }
      throw err;
    }
  }
}
