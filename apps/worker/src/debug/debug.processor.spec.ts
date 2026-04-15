import { Test } from "@nestjs/testing";
import { DeadLetterService } from "../common/queue/dead-letter.service";
import { DebugProcessor } from "./debug.processor";

describe("DebugProcessor", () => {
  let processor: DebugProcessor;
  const mockDeadLetterService = {
    moveToDeadLetter: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DebugProcessor,
        { provide: DeadLetterService, useValue: mockDeadLetterService },
      ],
    }).compile();

    processor = module.get(DebugProcessor);
  });

  afterEach(() => jest.clearAllMocks());

  it("should process a test job without throwing", async () => {
    const mockJob = {
      id: "job-1",
      data: { message: "Hello from debug endpoint", timestamp: "2026-04-14T00:00:00Z" },
    };

    await expect(processor.process(mockJob as never)).resolves.not.toThrow();
  });

  it("should move to dead letter queue when all retries exhausted", async () => {
    const mockJob = {
      id: "job-1",
      queueName: "invoice-sync",
      attemptsMade: 3,
      opts: { attempts: 3 },
      data: { message: "test" },
    };
    const error = new Error("processing failed");

    await processor.onFailed(mockJob as never, error);

    expect(mockDeadLetterService.moveToDeadLetter).toHaveBeenCalledWith(
      mockJob,
      error,
    );
  });

  it("should not move to dead letter queue when retries remain", async () => {
    const mockJob = {
      id: "job-1",
      attemptsMade: 1,
      opts: { attempts: 3 },
    };
    const error = new Error("transient failure");

    await processor.onFailed(mockJob as never, error);

    expect(mockDeadLetterService.moveToDeadLetter).not.toHaveBeenCalled();
  });
});
