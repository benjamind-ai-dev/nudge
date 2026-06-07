import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { envSchema, Env } from "./common/config/env.schema";
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
import { TwilioEventsModule } from "./modules/twilio-events/twilio-events.module";
import { WeeklySummaryModule } from "./modules/weekly-summary/weekly-summary.module";
import { AiDraftModule } from "./modules/ai-draft/ai-draft.module";
import { BusinessCleanupModule } from "./modules/business-cleanup/business-cleanup.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const nodeEnv = config.get("NODE_ENV", { infer: true });
        const logLevel = config.get("LOG_LEVEL", { infer: true });
        const level = logLevel ?? (nodeEnv === "production" ? "info" : "debug");
        return {
          pinoHttp: {
            name: "worker",
            level,
            autoLogging: false,
            transport: nodeEnv !== "production" ? { target: "pino-pretty" } : undefined,
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "*.password",
                "*.access_token",
                "*.refresh_token",
              ],
              censor: "[REDACTED]",
            },
          },
        };
      },
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
    AiDraftModule,
    DeadLetterMonitorModule,
    DaysRecalcModule,
    BusinessCleanupModule,
    StripeEventsModule,
    ResendEventsModule,
    TwilioEventsModule,
  ],
})
export class AppModule {}
