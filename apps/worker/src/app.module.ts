import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { envSchema } from "./common/config/env.schema";
import { DatabaseModule } from "./common/database/database.module";
import { RedisModule } from "./common/redis/redis.module";
import { QueueModule } from "./common/queue/queue.module";
import { DebugModule } from "./debug/debug.module";
import { SmsModule } from "./modules/sms/sms.module";

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
    DebugModule,
    SmsModule,
  ],
})
export class AppModule {}
