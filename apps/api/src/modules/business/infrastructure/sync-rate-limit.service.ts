import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS_CLIENT } from "../../../common/redis/redis.module";

export interface SyncRateLimitOutcome {
  acquired: boolean;
  retryAfterSeconds: number;
}

const DEFAULT_TTL_SECONDS = 300;
const keyFor = (businessId: string) => `sync-limit:${businessId}`;

@Injectable()
export class SyncRateLimitService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async tryAcquire(
    businessId: string,
    ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ): Promise<SyncRateLimitOutcome> {
    const key = keyFor(businessId);
    // ioredis overload: set(key, value, "EX", seconds, "NX") → "OK" | null
    const result = await this.redis.set(key, "1", "EX", ttlSeconds, "NX");
    if (result === "OK") {
      return { acquired: true, retryAfterSeconds: 0 };
    }
    // Denied. Probe TTL — defensive fallback to full TTL on -1/-2.
    // -1 means key exists with no TTL (should not happen given our writer always sets EX).
    // -2 means key expired between the failed SET and this TTL call (near-miss race).
    const ttl = await this.redis.ttl(key);
    const retryAfterSeconds = ttl > 0 ? ttl : ttlSeconds;
    return { acquired: false, retryAfterSeconds };
  }
}
