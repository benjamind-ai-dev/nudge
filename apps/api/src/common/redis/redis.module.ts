import {
  Module,
  Global,
  Inject,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { Env } from "../config/env.schema";

export const REDIS_CLIENT = Symbol("REDIS_CLIENT");

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService<Env, true>): Redis => {
        const redisUrl = config.get("REDIS_URL", { infer: true });

        if (redisUrl) {
          const parsed = new URL(redisUrl);
          return new Redis({
            host: parsed.hostname,
            port: parseInt(parsed.port || "6379", 10),
            password: parsed.password || undefined,
            username: parsed.username || undefined,
            family: config.get("REDIS_FAMILY", { infer: true }),
            maxRetriesPerRequest: null,
          });
        }

        return new Redis({
          host: config.get("REDIS_HOST", { infer: true }),
          port: config.get("REDIS_PORT", { infer: true }),
          maxRetriesPerRequest: null,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisModule.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onModuleInit() {
    await this.redis.ping();
    this.logger.log("Redis connected");
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
