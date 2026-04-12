import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  appContext.enableShutdownHooks();

  console.log("Worker started");
}

bootstrap().catch((err) => {
  console.error("Worker failed to start", err);
  process.exit(1);
});
