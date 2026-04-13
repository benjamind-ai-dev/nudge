import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { Env } from "./common/config/env.schema";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<Env, true>);
  const port = config.get("PORT", { infer: true });
  await app.listen(port);
}

bootstrap();
