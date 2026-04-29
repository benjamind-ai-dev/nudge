import { Module } from "@nestjs/common";
import { StripeWebhookController } from "./stripe-webhook.controller";
import { IngestStripeEventUseCase } from "./application/ingest-stripe-event.use-case";
import { StripeWebhookGuard } from "./infrastructure/stripe-webhook.guard";

@Module({
  controllers: [StripeWebhookController],
  providers: [IngestStripeEventUseCase, StripeWebhookGuard],
})
export class StripeWebhookModule {}
