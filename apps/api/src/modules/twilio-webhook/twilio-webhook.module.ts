import { Module } from "@nestjs/common";
import { TwilioWebhookController } from "./twilio-webhook.controller";

@Module({
  controllers: [TwilioWebhookController],
})
export class TwilioWebhookModule {}
