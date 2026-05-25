import { Module } from "@nestjs/common";
import { TwilioEventsProcessor } from "./twilio-events.processor";
import { HandleSmsReceivedUseCase } from "./application/handle-sms-received.use-case";
import {
  TWILIO_EVENTS_CUSTOMER_REPOSITORY,
  TWILIO_EVENTS_SEQUENCE_RUN_REPOSITORY,
  TWILIO_EVENTS_BUSINESS_REPOSITORY,
} from "./domain/twilio-events.repositories";
import { PrismaTwilioEventsCustomerRepository } from "./infrastructure/twilio-events-customer.repository";
import { PrismaTwilioEventsSequenceRunRepository } from "./infrastructure/twilio-events-sequence-run.repository";
import { PrismaTwilioEventsBusinessRepository } from "./infrastructure/twilio-events-business.repository";
import { EMAIL_SERVICE } from "../message-send/domain/email.service";
import { ResendEmailService } from "../message-send/infrastructure/resend-email.service";

@Module({
  providers: [
    TwilioEventsProcessor,
    HandleSmsReceivedUseCase,
    {
      provide: TWILIO_EVENTS_CUSTOMER_REPOSITORY,
      useClass: PrismaTwilioEventsCustomerRepository,
    },
    {
      provide: TWILIO_EVENTS_SEQUENCE_RUN_REPOSITORY,
      useClass: PrismaTwilioEventsSequenceRunRepository,
    },
    {
      provide: TWILIO_EVENTS_BUSINESS_REPOSITORY,
      useClass: PrismaTwilioEventsBusinessRepository,
    },
    {
      provide: EMAIL_SERVICE,
      useClass: ResendEmailService,
    },
  ],
})
export class TwilioEventsModule {}
