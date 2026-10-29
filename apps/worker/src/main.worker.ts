import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { Env } from "./common/config/env.schema";

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  appContext.useLogger(appContext.get(Logger));
  appContext.enableShutdownHooks();

  // Host and username only, never the password, to debug Redis auth on deploy.
  const config = appContext.get(ConfigService<Env, true>);
  const redisUrl = config.get("REDIS_URL", { infer: true });
  const redis = redisUrl ? new URL(redisUrl) : undefined;
  appContext.get(Logger).log(
    `Worker started (redis host=${redis?.hostname ?? "unset"}, user=${redis?.username || "none"})`,
    "Bootstrap",
  );
}

bootstrap().catch((err) => {
  console.error("Worker failed to start", err);
  process.exit(1);
});
