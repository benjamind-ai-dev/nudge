import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { Env } from "./common/config/env.schema";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  // Intuit's CloudEvents 2.0 webhooks arrive with content-type
  // `application/cloudevents-batch+json` (batched mode) or
  // `application/cloudevents+json` (structured mode). Express's default JSON
  // body-parser only matches `application/json`, which would leave
  // `req.rawBody` undefined and trip the IntuitSignatureGuard's missing_body
  // check. Extending the matcher here makes raw-body capture work for the
  // QuickBooks webhook endpoint without affecting any other route.
  app.useBodyParser("json", {
    type: [
      "application/json",
      "application/cloudevents+json",
      "application/cloudevents-batch+json",
    ],
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
