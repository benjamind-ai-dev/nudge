import { Module, RequestMethod } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { envSchema, Env } from "./common/config/env.schema";
import { DatabaseModule } from "./common/database/database.module";
import { QueueModule } from "./common/queue/queue.module";
import { RedisModule } from "./common/redis/redis.module";
import { HealthModule } from "./health/health.module";
import { DebugModule } from "./debug/debug.module";
import { TwilioWebhookModule } from "./modules/twilio-webhook/twilio-webhook.module";
import { XeroWebhookModule } from "./modules/xero-webhook/xero-webhook.module";
import { QuickbooksWebhookModule } from "./modules/quickbooks-webhook/quickbooks-webhook.module";
import { QuickbooksOAuthModule } from "./modules/quickbooks-oauth/quickbooks-oauth.module";
import { XeroOAuthModule } from "./modules/xero-oauth/xero-oauth.module";
import { ConnectionsCommonModule } from "./modules/connections-common/connections-common.module";
import { ConnectionsModule } from "./modules/connections/connections.module";
import { BusinessModule } from "./modules/business/business.module";
import { BillingModule } from "./modules/billing/billing.module";
import { StripeWebhookModule } from "./modules/stripe-webhook/stripe-webhook.module";
import { ClerkWebhookModule } from "./modules/clerk-webhook/clerk-webhook.module";

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
            name: "api",
            level,
            transport: nodeEnv !== "production"
              ? { target: "pino-pretty" }
              : undefined,
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
          exclude: [{ method: RequestMethod.GET, path: "/v1/health" }],
        };
      },
    }),
    DatabaseModule,
    QueueModule,
    RedisModule,
    HealthModule,
    DebugModule,
    TwilioWebhookModule,
    XeroWebhookModule,
    QuickbooksWebhookModule,
    QuickbooksOAuthModule,
    XeroOAuthModule,
    ConnectionsCommonModule,
    ConnectionsModule,
    BusinessModule,
    BillingModule,
    StripeWebhookModule,
    ClerkWebhookModule,
  ],
})
export class AppModule {}
