import { EnqueueReadyRunsUseCase } from "./enqueue-ready-runs.use-case";
import type { MessageSendRepository, RunReadyToSend } from "../domain/message-send.repository";
import { Queue } from "bullmq";

const createMockRun = (id: string): RunReadyToSend => ({
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
  businessId: "biz-1",
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
  stepIsOwnerAlert: false,
  stepDelayDays: 3,
});

describe("EnqueueReadyRunsUseCase", () => {
  let useCase: EnqueueReadyRunsUseCase;
  let repo: jest.Mocked<MessageSendRepository>;
  let queue: jest.Mocked<Queue>;

  beforeEach(() => {
    repo = {
      findRunsReadyToSend: jest.fn(),
      findRunById: jest.fn(),
      findNextStep: jest.fn(),
      messageExistsForRunStep: jest.fn(),
      createMessage: jest.fn(),
      advanceRunToNextStep: jest.fn(),
      completeRun: jest.fn(),
    };

    queue = {
      add: jest.fn().mockResolvedValue({ id: "job-1" }),
    } as unknown as jest.Mocked<Queue>;

    useCase = new EnqueueReadyRunsUseCase(repo, queue);
  });

  it("enqueues jobs for each run ready to send", async () => {
    repo.findRunsReadyToSend.mockResolvedValue([
      createMockRun("run-1"),
      createMockRun("run-2"),
      createMockRun("run-3"),
    ]);

    const result = await useCase.execute();

    expect(result.runsEnqueued).toBe(3);
    expect(queue.add).toHaveBeenCalledTimes(3);
    expect(queue.add).toHaveBeenCalledWith(
      "send-message",
      { runId: "run-1" },
      expect.objectContaining({
        attempts: 3,
        backoff: expect.objectContaining({ type: "exponential" }),
      }),
    );
  });

  it("returns zero when no runs are ready", async () => {
    repo.findRunsReadyToSend.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result.runsEnqueued).toBe(0);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
