import { Module } from "@nestjs/common";
import { TwilioService } from "./twilio.service";
import { SmsProcessor } from "./sms.processor";

@Module({
  providers: [TwilioService, SmsProcessor],
})
export class SmsModule {}
