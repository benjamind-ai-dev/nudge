import { Module } from "@nestjs/common";
import { TwilioWebhookController } from "./twilio-webhook.controller";
import { TwilioSignatureGuard } from "./infrastructure/twilio-signature.guard";
import { IngestTwilioInboundUseCase } from "./application/ingest-twilio-inbound.use-case";

@Module({
  controllers: [TwilioWebhookController],
  providers: [TwilioSignatureGuard, IngestTwilioInboundUseCase],
})
export class TwilioWebhookModule {}
