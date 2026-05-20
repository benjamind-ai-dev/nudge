import { SyncRateLimitService } from "./sync-rate-limit.service";

type RedisMock = {
  set: jest.Mock;
  ttl: jest.Mock;
};

const BIZ = "550e8400-e29b-41d4-a716-446655440000";
const KEY = `sync-limit:${BIZ}`;

function makeRedis(): RedisMock {
  return { set: jest.fn(), ttl: jest.fn() };
}

describe("SyncRateLimitService", () => {
  it("acquires on first call (SET NX EX returns OK)", async () => {
    const redis = makeRedis();
    redis.set.mockResolvedValue("OK");
    const svc = new SyncRateLimitService(redis as never);

    const out = await svc.tryAcquire(BIZ);

    expect(out).toEqual({ acquired: true, retryAfterSeconds: 0 });
    expect(redis.set).toHaveBeenCalledWith(KEY, "1", "EX", 300, "NX");
    expect(redis.ttl).not.toHaveBeenCalled();
  });

  it("denies when key already exists and reports remaining TTL", async () => {
    const redis = makeRedis();
    redis.set.mockResolvedValue(null);
    redis.ttl.mockResolvedValue(247);
    const svc = new SyncRateLimitService(redis as never);

    const out = await svc.tryAcquire(BIZ);

    expect(out).toEqual({ acquired: false, retryAfterSeconds: 247 });
    expect(redis.ttl).toHaveBeenCalledWith(KEY);
  });

  it("falls back to full TTL when key expired between set and ttl (-2)", async () => {
    const redis = makeRedis();
    redis.set.mockResolvedValue(null);
    redis.ttl.mockResolvedValue(-2);
    const svc = new SyncRateLimitService(redis as never);

    const out = await svc.tryAcquire(BIZ);

    expect(out).toEqual({ acquired: false, retryAfterSeconds: 300 });
  });

  it("falls back to full TTL when key has no TTL (-1)", async () => {
    const redis = makeRedis();
    redis.set.mockResolvedValue(null);
    redis.ttl.mockResolvedValue(-1);
    const svc = new SyncRateLimitService(redis as never);

    const out = await svc.tryAcquire(BIZ);

    expect(out).toEqual({ acquired: false, retryAfterSeconds: 300 });
  });

  it("honours a custom TTL", async () => {
    const redis = makeRedis();
    redis.set.mockResolvedValue("OK");
    const svc = new SyncRateLimitService(redis as never);

    await svc.tryAcquire(BIZ, 60);

    expect(redis.set).toHaveBeenCalledWith(KEY, "1", "EX", 60, "NX");
  });
});
