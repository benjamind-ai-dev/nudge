import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { QUEUE_NAMES } from "@nudge/shared";
import { DebugController } from "./debug.controller";

describe("DebugController", () => {
  let controller: DebugController;
  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: "test-job-1" }),
  };
  const mockConfig = {
    get: jest.fn().mockReturnValue("development"),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DebugController],
      providers: [
        {
          provide: getQueueToken(QUEUE_NAMES.INVOICE_SYNC),
          useValue: mockQueue,
        },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    controller = module.get(DebugController);
  });

  afterEach(() => jest.clearAllMocks());

  it("should enqueue a test job and return job id", async () => {
    const result = await controller.enqueueTestJob();

    expect(mockQueue.add).toHaveBeenCalledWith(
      "test-job",
      expect.objectContaining({
        message: "Hello from debug endpoint",
        timestamp: expect.any(String),
      }),
    );
    expect(result).toEqual({
      data: { jobId: "test-job-1", queue: QUEUE_NAMES.INVOICE_SYNC },
    });
  });

  it("should reject in production", async () => {
    mockConfig.get.mockReturnValue("production");

    const result = await controller.enqueueTestJob();

    expect(mockQueue.add).not.toHaveBeenCalled();
    expect(result.data).toHaveProperty("message");
  });
});
