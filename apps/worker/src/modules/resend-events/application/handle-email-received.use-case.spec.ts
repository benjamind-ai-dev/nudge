import { HandleEmailReceivedUseCase } from "./handle-email-received.use-case";
import type { ResendEventsCustomerRepository } from "../domain/resend-events-customer.repository";
import type { ResendEventsSequenceRunRepository } from "../domain/resend-events-sequence-run.repository";
import type { ResendEventsBusinessRepository } from "../domain/resend-events-business.repository";
import type { ResendEventsMessageRepository } from "../domain/resend-events-message.repository";
import type { AiDraftProducer } from "../domain/ai-draft.producer";
import type { EmailService } from "../../message-send/domain/email.service";

function makeDeps(overrides: {
  runs?: Array<{ runId: string; businessId: string; companyName: string }>;
  sentMessage?: { id: string; businessId: string } | null;
  ownerEmail?: string | null;
  enqueueRejects?: Error;
  sendRejects?: Error;
} = {}) {
  const customerRepo: jest.Mocked<ResendEventsCustomerRepository> = {
    findActiveRunsByContactEmail: jest.fn().mockResolvedValue(overrides.runs ?? []),
  };
  const runRepo: jest.Mocked<ResendEventsSequenceRunRepository> = {
    stopRun: jest.fn().mockResolvedValue(undefined),
    pauseRun: jest.fn().mockResolvedValue(undefined),
  };
  const businessRepo: jest.Mocked<ResendEventsBusinessRepository> = {
    findWithOwner: jest.fn().mockResolvedValue(
      overrides.ownerEmail === null
        ? null
        : { id: "biz-1", ownerEmail: overrides.ownerEmail ?? "owner@example.com" },
    ),
  };
  const messageRepo: jest.Mocked<ResendEventsMessageRepository> = {
    findByExternalId: jest.fn(),
    updateStatus: jest.fn(),
    updateOpenedAt: jest.fn(),
    updateClickedAt: jest.fn(),
    findLatestSentEmailForRun: jest
      .fn()
      .mockResolvedValue(overrides.sentMessage === undefined ? { id: "msg-1", businessId: "biz-1" } : overrides.sentMessage),
    markReplied: jest.fn().mockResolvedValue(undefined),
  };
  const aiDraftProducer: jest.Mocked<AiDraftProducer> = {
    enqueue: overrides.enqueueRejects
      ? jest.fn().mockRejectedValue(overrides.enqueueRejects)
      : jest.fn().mockResolvedValue(undefined),
  };
  const emailService: jest.Mocked<EmailService> = {
    send: overrides.sendRejects
      ? jest.fn().mockRejectedValue(overrides.sendRejects)
      : jest.fn().mockResolvedValue(undefined),
  };

  const uc = new HandleEmailReceivedUseCase(
    customerRepo,
    runRepo,
    businessRepo,
    messageRepo,
    aiDraftProducer,
    emailService,
  );

  return { uc, customerRepo, runRepo, businessRepo, messageRepo, aiDraftProducer, emailService };
}

describe("HandleEmailReceivedUseCase", () => {
  it("returns early when no active runs match the sender email", async () => {
    const deps = makeDeps({ runs: [] });
    await deps.uc.execute({ fromEmail: "no-such@example.com", replyBody: "hi" });

    expect(deps.runRepo.stopRun).not.toHaveBeenCalled();
    expect(deps.messageRepo.markReplied).not.toHaveBeenCalled();
    expect(deps.aiDraftProducer.enqueue).not.toHaveBeenCalled();
  });

  it("for each active run: persists reply body on the latest sent email, enqueues ai-draft, stops the run, and alerts the owner", async () => {
    const deps = makeDeps({
      runs: [{ runId: "run-1", businessId: "biz-1", companyName: "Midwest Plastics" }],
      sentMessage: { id: "msg-1", businessId: "biz-1" },
    });

    await deps.uc.execute({ fromEmail: "john@midwest.example.com", replyBody: "we dispute this" });

    expect(deps.messageRepo.findLatestSentEmailForRun).toHaveBeenCalledWith("run-1");
    expect(deps.messageRepo.markReplied).toHaveBeenCalledWith(
      "msg-1",
      "biz-1",
      "we dispute this",
      expect.any(Date),
    );
    expect(deps.aiDraftProducer.enqueue).toHaveBeenCalledWith("msg-1", "biz-1");
    expect(deps.runRepo.stopRun).toHaveBeenCalledWith("run-1", "biz-1", "client_replied");
    expect(deps.emailService.send).toHaveBeenCalledTimes(1);
  });

  it("skips draft enqueue when no sent email exists on the run, but still stops the run and alerts the owner", async () => {
    const deps = makeDeps({
      runs: [{ runId: "run-1", businessId: "biz-1", companyName: "Midwest Plastics" }],
      sentMessage: null,
    });

    await deps.uc.execute({ fromEmail: "john@midwest.example.com", replyBody: "ok" });

    expect(deps.messageRepo.markReplied).not.toHaveBeenCalled();
    expect(deps.aiDraftProducer.enqueue).not.toHaveBeenCalled();
    expect(deps.runRepo.stopRun).toHaveBeenCalledTimes(1);
    expect(deps.emailService.send).toHaveBeenCalledTimes(1);
  });

  it("continues processing when ai-draft enqueue fails (does not throw)", async () => {
    const deps = makeDeps({
      runs: [{ runId: "run-1", businessId: "biz-1", companyName: "Midwest Plastics" }],
      sentMessage: { id: "msg-1", businessId: "biz-1" },
      enqueueRejects: new Error("redis down"),
    });

    await expect(
      deps.uc.execute({ fromEmail: "john@midwest.example.com", replyBody: "hello" }),
    ).resolves.toBeUndefined();

    expect(deps.messageRepo.markReplied).toHaveBeenCalled();
    expect(deps.runRepo.stopRun).toHaveBeenCalled();
    expect(deps.emailService.send).toHaveBeenCalled();
  });

  it("processes all matching runs even when one has no sent email", async () => {
    const deps = makeDeps({
      runs: [
        { runId: "run-1", businessId: "biz-1", companyName: "First" },
        { runId: "run-2", businessId: "biz-2", companyName: "Second" },
      ],
    });
    deps.messageRepo.findLatestSentEmailForRun
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "msg-2", businessId: "biz-2" });

    await deps.uc.execute({ fromEmail: "client@example.com", replyBody: "hi" });

    expect(deps.runRepo.stopRun).toHaveBeenCalledTimes(2);
    expect(deps.messageRepo.markReplied).toHaveBeenCalledTimes(1);
    expect(deps.messageRepo.markReplied).toHaveBeenCalledWith("msg-2", "biz-2", "hi", expect.any(Date));
    expect(deps.aiDraftProducer.enqueue).toHaveBeenCalledTimes(1);
    expect(deps.aiDraftProducer.enqueue).toHaveBeenCalledWith("msg-2", "biz-2");
  });
});
