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
  ],
})
export class AppModule {}
