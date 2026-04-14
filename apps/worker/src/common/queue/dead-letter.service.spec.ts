import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@nudge/shared";
import { DeadLetterService } from "./dead-letter.service";

describe("DeadLetterService", () => {
  let service: DeadLetterService;
  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: "dlq-1" }),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DeadLetterService,
        {
          provide: getQueueToken(QUEUE_NAMES.DEAD_LETTER),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get(DeadLetterService);
  });

  afterEach(() => jest.clearAllMocks());

  it("should enqueue failed job data to dead letter queue", async () => {
    const mockJob = {
      id: "job-123",
      queueName: "invoice-sync",
      attemptsMade: 3,
      data: { businessId: "biz-1" },
    };
    const error = new Error("Connection timeout");

    await service.moveToDeadLetter(mockJob as never, error);

    expect(mockQueue.add).toHaveBeenCalledWith("dead-letter", {
      originalQueue: "invoice-sync",
      originalJobId: "job-123",
      data: { businessId: "biz-1" },
      failedReason: "Connection timeout",
      failedAt: expect.any(String),
    });
  });
});
