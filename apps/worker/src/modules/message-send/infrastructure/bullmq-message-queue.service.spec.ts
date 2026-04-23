import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { QUEUE_NAMES, JOB_NAMES } from "@nudge/shared";
import { BullMQMessageQueueService } from "./bullmq-message-queue.service";

describe("BullMQMessageQueueService", () => {
  let service: BullMQMessageQueueService;
  let queue: jest.Mocked<Queue>;

  beforeEach(async () => {
    queue = {
      add: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<Queue>;

    const module = await Test.createTestingModule({
      providers: [
        BullMQMessageQueueService,
        { provide: getQueueToken(QUEUE_NAMES.MESSAGE_SEND), useValue: queue },
      ],
    }).compile();

    service = module.get(BullMQMessageQueueService);
  });

  it("enqueues job with correct job name and data", async () => {
    const data = { sequenceRunId: "run-123", businessId: "biz-456" };
    const options = {
      attempts: 3,
      backoff: { type: "exponential" as const, delay: 60000 },
    };

    await service.enqueueSendMessage(data, options);

    expect(queue.add).toHaveBeenCalledWith(
      JOB_NAMES.SEND_MESSAGE,
      data,
      expect.objectContaining({
        attempts: 3,
        backoff: { type: "exponential", delay: 60000 },
      }),
    );
  });

  it("uses deterministic jobId based on sequenceRunId to prevent double-enqueue", async () => {
    const data = { sequenceRunId: "run-abc-123", businessId: "biz-456" };
    const options = {
      attempts: 3,
      backoff: { type: "exponential" as const, delay: 60000 },
    };

    await service.enqueueSendMessage(data, options);

    expect(queue.add).toHaveBeenCalledWith(
      JOB_NAMES.SEND_MESSAGE,
      data,
      expect.objectContaining({
        jobId: "send-run-abc-123",
      }),
    );
  });

  it("generates consistent jobId for same sequenceRunId", async () => {
    const data1 = { sequenceRunId: "run-xyz", businessId: "biz-1" };
    const data2 = { sequenceRunId: "run-xyz", businessId: "biz-2" };
    const options = {
      attempts: 3,
      backoff: { type: "exponential" as const, delay: 60000 },
    };

    await service.enqueueSendMessage(data1, options);
    await service.enqueueSendMessage(data2, options);

    const call1JobId = queue.add.mock.calls[0][2].jobId;
    const call2JobId = queue.add.mock.calls[1][2].jobId;

    expect(call1JobId).toBe("send-run-xyz");
    expect(call2JobId).toBe("send-run-xyz");
    expect(call1JobId).toBe(call2JobId);
  });
});
