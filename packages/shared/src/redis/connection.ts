import { RedisOptions } from "ioredis";
import { ConnectionOptions } from "bullmq";

function buildRedisOptions(): RedisOptions {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379", 10),
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      family: parseInt(process.env.REDIS_FAMILY ?? "4", 10) as 4 | 6,
    };
  }

  return {
    host: process.env.REDIS_HOST ?? "localhost",
    port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
  };
}

export function getRedisConnection(): ConnectionOptions {
  return {
    ...buildRedisOptions(),
    maxRetriesPerRequest: null,
  };
}

export function getRedisOptions(): RedisOptions {
  return buildRedisOptions();
}
