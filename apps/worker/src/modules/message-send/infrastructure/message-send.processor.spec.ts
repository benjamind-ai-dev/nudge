import { Test } from "@nestjs/testing";
import { Job } from "bullmq";
import { MessageSendProcessor } from "./message-send.processor";
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
    const job = { name: "message-send-tick", id: "job-1", data: {} } as Job;

    await processor.process(job);

    expect(enqueueReadyRuns.execute).toHaveBeenCalled();
    expect(sendMessage.execute).not.toHaveBeenCalled();
  });

  it("calls SendMessageUseCase on send-message job", async () => {
    const job = {
      name: "send-message",
      id: "job-2",
      data: { runId: "run-123" },
      attemptsMade: 0,
    } as unknown as Job<{ runId: string }>;

    await processor.process(job);

    expect(sendMessage.execute).toHaveBeenCalledWith({ runId: "run-123" });
    expect(enqueueReadyRuns.execute).not.toHaveBeenCalled();
  });
});
