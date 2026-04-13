import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  appContext.useLogger(appContext.get(Logger));
  appContext.enableShutdownHooks();
}

bootstrap().catch((err) => {
  console.error("Worker failed to start", err);
  process.exit(1);
});
