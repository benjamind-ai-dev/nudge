import { Test } from "@nestjs/testing";
import { EnqueueReadyRunsUseCase } from "./enqueue-ready-runs.use-case";
import {
  MESSAGE_SEND_REPOSITORY,
  type MessageSendRepository,
  type RunReadyToSend,
} from "../domain/message-send.repository";
import { MESSAGE_QUEUE_SERVICE, type MessageQueueService } from "../domain/message-queue.service";

const createMockRun = (id: string, businessId = "biz-1"): RunReadyToSend => ({
  runId: id,
  runStatus: "active",
  invoiceId: "inv-1",
  invoiceNumber: "INV-001",
  amountCents: 100000,
  balanceDueCents: 100000,
  dueDate: new Date("2026-04-10"),
  paymentLinkUrl: null,
  customerId: "cust-1",
  customerCompanyName: "Acme Corp",
  customerContactName: "Sarah",
  customerContactEmail: "sarah@acme.com",
  customerContactPhone: "+15551234567",
  businessId,
  businessName: "Bob's Plumbing",
  businessSenderName: "Bob Smith",
  businessSenderEmail: "bob@bobsplumbing.com",
  businessEmailSignature: null,
  businessTimezone: "America/New_York",
  sequenceId: "seq-1",
  stepId: "step-1",
  stepOrder: 1,
  stepChannel: "email",
  stepSubjectTemplate: "Reminder",
  stepBodyTemplate: "Body",
  stepSmsBodyTemplate: null,
  stepIsOwnerAlert: false,
  stepDelayDays: 3,
});

describe("EnqueueReadyRunsUseCase", () => {
  let useCase: EnqueueReadyRunsUseCase;
  let repo: jest.Mocked<MessageSendRepository>;
  let queueService: jest.Mocked<MessageQueueService>;

  beforeEach(async () => {
    repo = {
      findRunsReadyToSend: jest.fn(),
      findRunById: jest.fn(),
      findNextStep: jest.fn(),
      messageExistsForRunStep: jest.fn(),
      createMessage: jest.fn(),
      advanceRunToNextStep: jest.fn(),
      completeRun: jest.fn(),
    };

    queueService = {
      enqueueSendMessage: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        EnqueueReadyRunsUseCase,
        { provide: MESSAGE_SEND_REPOSITORY, useValue: repo },
        { provide: MESSAGE_QUEUE_SERVICE, useValue: queueService },
      ],
    }).compile();

    useCase = module.get(EnqueueReadyRunsUseCase);
  });

  it("enqueues jobs for each run ready to send with businessId", async () => {
    repo.findRunsReadyToSend.mockResolvedValue([
      createMockRun("run-1", "biz-1"),
      createMockRun("run-2", "biz-2"),
      createMockRun("run-3", "biz-1"),
    ]);

    const result = await useCase.execute();

    expect(result.runsEnqueued).toBe(3);
    expect(queueService.enqueueSendMessage).toHaveBeenCalledTimes(3);
    expect(queueService.enqueueSendMessage).toHaveBeenCalledWith(
      { sequenceRunId: "run-1", businessId: "biz-1" },
      expect.objectContaining({
        attempts: 3,
        backoff: expect.objectContaining({ type: "exponential" }),
      }),
    );
    expect(queueService.enqueueSendMessage).toHaveBeenCalledWith(
      { sequenceRunId: "run-2", businessId: "biz-2" },
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it("returns zero when no runs are ready", async () => {
    repo.findRunsReadyToSend.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result.runsEnqueued).toBe(0);
    expect(queueService.enqueueSendMessage).not.toHaveBeenCalled();
  });

  it("propagates error when findRunsReadyToSend rejects", async () => {
    const dbError = new Error("Database connection lost");
    repo.findRunsReadyToSend.mockRejectedValue(dbError);

    await expect(useCase.execute()).rejects.toThrow("Database connection lost");
    expect(queueService.enqueueSendMessage).not.toHaveBeenCalled();
  });

  it("propagates error when enqueueSendMessage fails mid-batch", async () => {
    repo.findRunsReadyToSend.mockResolvedValue([
      createMockRun("run-1", "biz-1"),
      createMockRun("run-2", "biz-2"),
      createMockRun("run-3", "biz-3"),
    ]);

    const queueError = new Error("Redis unavailable");
    queueService.enqueueSendMessage
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(queueError);

    await expect(useCase.execute()).rejects.toThrow("Redis unavailable");
    expect(queueService.enqueueSendMessage).toHaveBeenCalledTimes(2);
  });
});
