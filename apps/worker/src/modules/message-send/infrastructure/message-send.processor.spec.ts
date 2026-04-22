import { Test } from "@nestjs/testing";
import { Job } from "bullmq";
import type { MessageSendJobData } from "@nudge/shared";
import { MessageSendProcessor } from "./message-send.processor";
import { JOB_NAMES } from "../constants";
import { EnqueueReadyRunsUseCase } from "../application/enqueue-ready-runs.use-case";
import { SendMessageUseCase } from "../application/send-message.use-case";

describe("MessageSendProcessor", () => {
  let processor: MessageSendProcessor;
  let enqueueReadyRuns: jest.Mocked<EnqueueReadyRunsUseCase>;
  let sendMessage: jest.Mocked<SendMessageUseCase>;

  beforeEach(async () => {
    enqueueReadyRuns = {
      execute: jest.fn().mockResolvedValue({ runsEnqueued: 5 }),
    } as unknown as jest.Mocked<EnqueueReadyRunsUseCase>;

    sendMessage = {
      execute: jest.fn().mockResolvedValue({ sent: true, messagesSent: 1 }),
    } as unknown as jest.Mocked<SendMessageUseCase>;

    const module = await Test.createTestingModule({
      providers: [
        MessageSendProcessor,
        { provide: EnqueueReadyRunsUseCase, useValue: enqueueReadyRuns },
        { provide: SendMessageUseCase, useValue: sendMessage },
      ],
    }).compile();

    processor = module.get(MessageSendProcessor);
  });

  it("calls EnqueueReadyRunsUseCase on message-send-tick job", async () => {
    const job = { name: JOB_NAMES.MESSAGE_SEND_TICK, id: "job-1", data: {} } as Job;

    await processor.process(job);

    expect(enqueueReadyRuns.execute).toHaveBeenCalled();
    expect(sendMessage.execute).not.toHaveBeenCalled();
  });

  it("calls SendMessageUseCase on send-message job", async () => {
    const jobData: MessageSendJobData = {
      sequenceRunId: "run-123",
      businessId: "biz-456",
    };
    const job = {
      name: JOB_NAMES.SEND_MESSAGE,
      id: "job-2",
      data: jobData,
      attemptsMade: 0,
    } as unknown as Job<MessageSendJobData>;

    await processor.process(job);

    expect(sendMessage.execute).toHaveBeenCalledWith({
      sequenceRunId: "run-123",
      businessId: "biz-456",
    });
    expect(enqueueReadyRuns.execute).not.toHaveBeenCalled();
  });
});
