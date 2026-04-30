import { IngestResendEventsUseCase } from "./ingest-resend-events.use-case";
import { DuplicateResendBatchError } from "../domain/resend-webhook.errors";
import type { Queue } from "bullmq";
import type Redis from "ioredis";

function makeRedis(setResult: string | null): jest.Mocked<Pick<Redis, "set">> {
  return { set: jest.fn().mockResolvedValue(setResult) } as unknown as jest.Mocked<Pick<Redis, "set">>;
}

function makeQueue(): jest.Mocked<Pick<Queue, "add">> {
  return { add: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<Pick<Queue, "add">>;
}

describe("IngestResendEventsUseCase", () => {
  const events = [{ type: "email.delivered", created_at: "2024-01-01T00:00:00.000Z", data: { email_id: "re_abc" } }];
  const rawBody = Buffer.from(JSON.stringify(events));

  it("enqueues a job for a new batch", async () => {
    const redis = makeRedis("OK");
    const queue = makeQueue();
    const useCase = new IngestResendEventsUseCase(redis as unknown as Redis, queue as unknown as Queue);

    await useCase.execute({ events, rawBody });

    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      "process-resend-events",
      { payload: events },
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it("throws DuplicateResendBatchError for an already-seen batch", async () => {
    const redis = makeRedis(null); // null = NX failed = already exists
    const queue = makeQueue();
    const useCase = new IngestResendEventsUseCase(redis as unknown as Redis, queue as unknown as Queue);

    await expect(useCase.execute({ events, rawBody })).rejects.toThrow(DuplicateResendBatchError);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("uses the same idempotency key for identical raw bodies", async () => {
    const redis = makeRedis("OK");
    const queue = makeQueue();
    const useCase = new IngestResendEventsUseCase(redis as unknown as Redis, queue as unknown as Queue);

    await useCase.execute({ events, rawBody });
    const firstKey = (redis.set as jest.Mock).mock.calls[0][0] as string;

    await useCase.execute({ events, rawBody });
    const secondKey = (redis.set as jest.Mock).mock.calls[1][0] as string;

    expect(firstKey).toBe(secondKey);
    expect(firstKey).toMatch(/^resend:batch:[a-f0-9]{64}$/);
  });
});
