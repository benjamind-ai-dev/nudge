import { Module, RequestMethod } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { envSchema, Env } from "./common/config/env.schema";
import { DatabaseModule } from "./common/database/database.module";
import { HealthModule } from "./health/health.module";

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
    HealthModule,
  ],
})
export class AppModule {}
