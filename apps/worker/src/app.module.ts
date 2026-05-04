import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { envSchema } from "./common/config/env.schema";
import { DatabaseModule } from "./common/database/database.module";
import { RedisModule } from "./common/redis/redis.module";
import { QueueModule } from "./common/queue/queue.module";
import { SmsModule } from "./modules/sms/sms.module";
import { TokenRefreshModule } from "./modules/token-refresh/token-refresh.module";
import { InvoiceSyncModule } from "./modules/invoice-sync/invoice-sync.module";
import { QuickbooksWebhookSyncModule } from "./modules/quickbooks-webhook-sync/quickbooks-webhook-sync.module";
import { XeroWebhookSyncModule } from "./modules/xero-webhook-sync/xero-webhook-sync.module";
import { SequenceTriggerModule } from "./modules/sequence-trigger/sequence-trigger.module";
import { MessageSendModule } from "./modules/message-send/message-send.module";
import { DeadLetterMonitorModule } from "./modules/dead-letter-monitor/dead-letter-monitor.module";
import { DaysRecalcModule } from "./modules/days-recalc/days-recalc.module";
import { StripeEventsModule } from "./modules/stripe-events/stripe-events.module";
import { ResendEventsModule } from "./modules/resend-events/resend-events.module";
import { WeeklySummaryModule } from "./modules/weekly-summary/weekly-summary.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    LoggerModule.forRoot({
      pinoHttp: { autoLogging: false },
    }),
    DatabaseModule,
    RedisModule,
    QueueModule,
    SmsModule,
    TokenRefreshModule,
    InvoiceSyncModule,
    QuickbooksWebhookSyncModule,
    XeroWebhookSyncModule,
    SequenceTriggerModule,
    MessageSendModule,
    WeeklySummaryModule,
    DeadLetterMonitorModule,
    DaysRecalcModule,
    StripeEventsModule,
    ResendEventsModule,
  ],
})
export class AppModule {}
