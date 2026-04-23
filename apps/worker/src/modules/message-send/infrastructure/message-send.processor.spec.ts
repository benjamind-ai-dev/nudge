import { Test } from "@nestjs/testing";
import { Job } from "bullmq";
import { JOB_NAMES, type MessageSendJobData } from "@nudge/shared";
import { MessageSendProcessor } from "./message-send.processor";
import { EnqueueReadyRunsUseCase } from "../application/enqueue-ready-runs.use-case";
import { SendMessageUseCase } from "../application/send-message.use-case";
import { DeadLetterService } from "../../../common/queue/dead-letter.service";

describe("MessageSendProcessor", () => {
  let processor: MessageSendProcessor;
  let enqueueReadyRuns: jest.Mocked<EnqueueReadyRunsUseCase>;
  let sendMessage: jest.Mocked<SendMessageUseCase>;
  let deadLetterService: jest.Mocked<DeadLetterService>;

  beforeEach(async () => {
    enqueueReadyRuns = {
      execute: jest.fn().mockResolvedValue({ runsEnqueued: 5 }),
    } as unknown as jest.Mocked<EnqueueReadyRunsUseCase>;

    sendMessage = {
      execute: jest.fn().mockResolvedValue({ sent: true, messagesSent: 1 }),
    } as unknown as jest.Mocked<SendMessageUseCase>;

    deadLetterService = {
      moveToDeadLetter: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DeadLetterService>;

    const module = await Test.createTestingModule({
      providers: [
        MessageSendProcessor,
        { provide: EnqueueReadyRunsUseCase, useValue: enqueueReadyRuns },
        { provide: SendMessageUseCase, useValue: sendMessage },
        { provide: DeadLetterService, useValue: deadLetterService },
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

  it("moves job to dead letter queue when permanently failed", async () => {
    const error = new Error("Provider unavailable");
    const job = {
      name: JOB_NAMES.SEND_MESSAGE,
      id: "job-4",
      data: { sequenceRunId: "run-1", businessId: "biz-1" },
      attemptsMade: 3,
      opts: { attempts: 3 },
      queueName: "message-send",
    } as unknown as Job;

    await processor.onFailed(job, error);

    expect(deadLetterService.moveToDeadLetter).toHaveBeenCalledWith(job, error);
  });

  it("does not move to dead letter when retries remain", async () => {
    const error = new Error("Temporary failure");
    const job = {
      name: JOB_NAMES.SEND_MESSAGE,
      id: "job-5",
      data: { sequenceRunId: "run-1", businessId: "biz-1" },
      attemptsMade: 1,
      opts: { attempts: 3 },
      queueName: "message-send",
    } as unknown as Job;

    await processor.onFailed(job, error);

    expect(deadLetterService.moveToDeadLetter).not.toHaveBeenCalled();
  });

  it("logs warning and does nothing for unknown job names", async () => {
    const loggerWarnSpy = jest.spyOn(processor["logger"], "warn");
    const job = {
      name: "unknown-job-type",
      id: "job-3",
      data: {},
    } as Job;

    await processor.process(job);

    expect(enqueueReadyRuns.execute).not.toHaveBeenCalled();
    expect(sendMessage.execute).not.toHaveBeenCalled();
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "unknown_job_name",
        jobName: "unknown-job-type",
      }),
    );
  });
});
