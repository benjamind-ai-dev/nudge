import { Module } from "@nestjs/common";
import { XeroWebhookController } from "./xero-webhook.controller";

@Module({
  controllers: [XeroWebhookController],
})
export class XeroWebhookModule {}
