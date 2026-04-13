import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { envSchema } from "./common/config/env.schema";
import { RedisModule } from "./common/redis/redis.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    LoggerModule.forRoot({
      // Worker is not an HTTP app — disable automatic request/response logging
      // while still providing PinoLogger as an injectable for structured logging
      pinoHttp: { autoLogging: false },
    }),
    RedisModule,
  ],
})
export class AppModule {}
