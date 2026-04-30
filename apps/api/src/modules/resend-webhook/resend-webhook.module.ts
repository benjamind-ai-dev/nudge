import { Module } from "@nestjs/common";
import { ResendWebhookController } from "./resend-webhook.controller";
import { IngestResendEventsUseCase } from "./application/ingest-resend-events.use-case";
import { ResendWebhookGuard } from "./infrastructure/resend-webhook.guard";

@Module({
  controllers: [ResendWebhookController],
  providers: [IngestResendEventsUseCase, ResendWebhookGuard],
})
export class ResendWebhookModule {}
