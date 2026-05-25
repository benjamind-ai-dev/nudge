import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { Redis } from "ioredis";
import { Env } from "../config/env.schema";
import { ThrottlerBehindProxyGuard } from "./throttler-behind-proxy.guard";
import { RATE_LIMITS, RATE_LIMIT_NAMES } from "./throttler-config";

function createStorageRedis(config: ConfigService<Env, true>): Redis {
  const redisUrl = config.get("REDIS_URL", { infer: true });
  if (redisUrl) {
    const parsed = new URL(redisUrl);
    return new Redis({
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379", 10),
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      family: config.get("REDIS_FAMILY", { infer: true }),
    });
  }
  return new Redis({
    host: config.get("REDIS_HOST", { infer: true }),
    port: config.get("REDIS_PORT", { infer: true }),
    family: config.get("REDIS_FAMILY", { infer: true }),
  });
}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [
          {
            name: RATE_LIMIT_NAMES.DEFAULT,
            ttl: RATE_LIMITS.DEFAULT.ttl,
            limit: RATE_LIMITS.DEFAULT.limit,
          },
          {
            name: RATE_LIMIT_NAMES.WEBHOOKS,
            ttl: RATE_LIMITS.WEBHOOKS.ttl,
            limit: RATE_LIMITS.WEBHOOKS.limit,
          },
          {
            name: RATE_LIMIT_NAMES.AUTH,
            ttl: RATE_LIMITS.AUTH.ttl,
            limit: RATE_LIMITS.AUTH.limit,
          },
        ],
        storage: new ThrottlerStorageRedisService(createStorageRedis(config)),
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard }],
})
export class ThrottlerConfigModule {}
