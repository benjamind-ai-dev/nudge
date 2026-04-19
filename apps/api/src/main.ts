import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { Env } from "./common/config/env.schema";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new GlobalExceptionFilter());

  const config = app.get(ConfigService<Env, true>);

  const allowedOrigins = config
    .get("CORS_ALLOWED_ORIGINS", { infer: true })
    .split(",")
    .map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    credentials: true,
  });

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
}

bootstrap();
