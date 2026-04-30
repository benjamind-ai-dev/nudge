import { Module } from "@nestjs/common";
import { ResendEventsProcessor } from "./resend-events.processor";
import { RESEND_EVENTS_MESSAGE_REPOSITORY } from "./domain/resend-events-message.repository";
import { RESEND_EVENTS_SEQUENCE_RUN_REPOSITORY } from "./domain/resend-events-sequence-run.repository";
import { RESEND_EVENTS_BUSINESS_REPOSITORY } from "./domain/resend-events-business.repository";
import { PrismaResendEventsMessageRepository } from "./infrastructure/resend-events-message.repository";
import { PrismaResendEventsSequenceRunRepository } from "./infrastructure/resend-events-sequence-run.repository";
import { PrismaResendEventsBusinessRepository } from "./infrastructure/resend-events-business.repository";

@Module({
  providers: [
    ResendEventsProcessor,
    {
      provide: RESEND_EVENTS_MESSAGE_REPOSITORY,
      useClass: PrismaResendEventsMessageRepository,
    },
    {
      provide: RESEND_EVENTS_SEQUENCE_RUN_REPOSITORY,
      useClass: PrismaResendEventsSequenceRunRepository,
    },
    {
      provide: RESEND_EVENTS_BUSINESS_REPOSITORY,
      useClass: PrismaResendEventsBusinessRepository,
    },
  ],
})
export class ResendEventsModule {}
