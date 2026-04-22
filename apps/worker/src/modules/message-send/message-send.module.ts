import { Module } from "@nestjs/common";
import { MESSAGE_SEND_REPOSITORY } from "./domain/message-send.repository";
import { TEMPLATE_SERVICE } from "./domain/template.service";
import { EMAIL_SERVICE } from "./domain/email.service";
import { SMS_SERVICE } from "./domain/sms.service";
import { PrismaMessageSendRepository } from "./infrastructure/prisma-message-send.repository";
import { HandlebarsTemplateService } from "./infrastructure/handlebars-template.service";
import { ResendEmailService } from "./infrastructure/resend-email.service";
import { TwilioSmsService } from "./infrastructure/twilio-sms.service";
import { MessageSendProcessor } from "./infrastructure/message-send.processor";
import { EnqueueReadyRunsUseCase } from "./application/enqueue-ready-runs.use-case";
import { SendMessageUseCase } from "./application/send-message.use-case";

@Module({
  providers: [
    MessageSendProcessor,
    EnqueueReadyRunsUseCase,
    SendMessageUseCase,
    {
      provide: MESSAGE_SEND_REPOSITORY,
      useClass: PrismaMessageSendRepository,
    },
    {
      provide: TEMPLATE_SERVICE,
      useClass: HandlebarsTemplateService,
    },
    {
      provide: EMAIL_SERVICE,
      useClass: ResendEmailService,
    },
    {
      provide: SMS_SERVICE,
      useClass: TwilioSmsService,
    },
  ],
})
export class MessageSendModule {}
