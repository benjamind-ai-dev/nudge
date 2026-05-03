import { Module } from "@nestjs/common";
import { ResendEventsProcessor } from "./resend-events.processor";
import { HandleEmailDeliveredUseCase } from "./application/handle-email-delivered.use-case";
import { HandleEmailOpenedUseCase } from "./application/handle-email-opened.use-case";
import { HandleEmailClickedUseCase } from "./application/handle-email-clicked.use-case";
import { HandleEmailBouncedUseCase } from "./application/handle-email-bounced.use-case";
import { HandleEmailComplainedUseCase } from "./application/handle-email-complained.use-case";
import { HandleEmailFailedUseCase } from "./application/handle-email-failed.use-case";
import { HandleEmailReceivedUseCase } from "./application/handle-email-received.use-case";
import {
  RESEND_EVENTS_MESSAGE_REPOSITORY,
} from "./domain/resend-events-message.repository";
import {
  RESEND_EVENTS_SEQUENCE_RUN_REPOSITORY,
} from "./domain/resend-events-sequence-run.repository";
import {
  RESEND_EVENTS_BUSINESS_REPOSITORY,
} from "./domain/resend-events-business.repository";
import {
  RESEND_EVENTS_CUSTOMER_REPOSITORY,
} from "./domain/resend-events-customer.repository";
import { PrismaResendEventsMessageRepository } from "./infrastructure/resend-events-message.repository";
import { PrismaResendEventsSequenceRunRepository } from "./infrastructure/resend-events-sequence-run.repository";
import { PrismaResendEventsBusinessRepository } from "./infrastructure/resend-events-business.repository";
import { PrismaResendEventsCustomerRepository } from "./infrastructure/resend-events-customer.repository";
import { EMAIL_SERVICE } from "../message-send/domain/email.service";
import { ResendEmailService } from "../message-send/infrastructure/resend-email.service";

@Module({
  providers: [
    ResendEventsProcessor,
    HandleEmailDeliveredUseCase,
    HandleEmailOpenedUseCase,
    HandleEmailClickedUseCase,
    HandleEmailBouncedUseCase,
    HandleEmailComplainedUseCase,
    HandleEmailFailedUseCase,
    HandleEmailReceivedUseCase,
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
    {
      provide: RESEND_EVENTS_CUSTOMER_REPOSITORY,
      useClass: PrismaResendEventsCustomerRepository,
    },
    {
      provide: EMAIL_SERVICE,
      useClass: ResendEmailService,
    },
  ],
})
export class ResendEventsModule {}
