import { Module, Global } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { QUEUE_NAMES } from "@nudge/shared";
import { Env } from "../config/env.schema";
import { RepeatableJobsService } from "./repeatable-jobs.service";
import { DeadLetterService } from "./dead-letter.service";

const allQueues = Object.values(QUEUE_NAMES).map((name) => ({ name }));

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService<Env, true>) => {
        const redisUrl = config.get("REDIS_URL", { infer: true });

        if (redisUrl) {
          const parsed = new URL(redisUrl);
          return {
            connection: {
              host: parsed.hostname,
              port: parseInt(parsed.port || "6379", 10),
              password: parsed.password || undefined,
              username: parsed.username || undefined,
              family: config.get("REDIS_FAMILY", { infer: true }),
              maxRetriesPerRequest: null,
            },
          };
        }

        return {
          connection: {
            host: config.get("REDIS_HOST", { infer: true }),
            port: config.get("REDIS_PORT", { infer: true }),
            family: config.get("REDIS_FAMILY", { infer: true }),
            maxRetriesPerRequest: null,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue(...allQueues),
  ],
  providers: [RepeatableJobsService, DeadLetterService],
  exports: [BullModule, DeadLetterService],
})
export class QueueModule {}
