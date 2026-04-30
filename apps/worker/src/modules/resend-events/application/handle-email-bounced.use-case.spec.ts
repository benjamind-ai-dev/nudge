import { HandleEmailBouncedUseCase } from "./handle-email-bounced.use-case";
import type { MessageRecord, ResendEventsMessageRepository } from "../domain/resend-events-message.repository";
import type { ResendEventsSequenceRunRepository } from "../domain/resend-events-sequence-run.repository";
import type { ResendEventsBusinessRepository } from "../domain/resend-events-business.repository";
import type { EmailService } from "../../message-send/domain/email.service";

const mockMessage: MessageRecord = {
  id: "msg-uuid",
  businessId: "biz-uuid",
  sequenceRunId: "run-uuid",
  status: "sent",
  openedAt: null,
  clickedAt: null,
};

const mockBusiness = { name: "Acme Corp", ownerEmail: "sandra@example.com" };

function makeMessageRepo(message = mockMessage): jest.Mocked<ResendEventsMessageRepository> {
  return {
    findByExternalId: jest.fn().mockResolvedValue(message),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    updateOpenedAt: jest.fn(),
    updateClickedAt: jest.fn(),
  };
}

function makeRunRepo(): jest.Mocked<ResendEventsSequenceRunRepository> {
  return {
    stopRun: jest.fn().mockResolvedValue(undefined),
    pauseRun: jest.fn(),
  };
}

function makeBusinessRepo(business = mockBusiness): jest.Mocked<ResendEventsBusinessRepository> {
  return { findWithOwner: jest.fn().mockResolvedValue(business) };
}

function makeEmailService(): jest.Mocked<EmailService> {
  return { send: jest.fn().mockResolvedValue({ externalMessageId: "re_alert" }) };
}

describe("HandleEmailBouncedUseCase", () => {
  it("marks message as bounced, stops the sequence run, and sends alert", async () => {
    const messageRepo = makeMessageRepo();
    const runRepo = makeRunRepo();
    const businessRepo = makeBusinessRepo();
    const emailService = makeEmailService();

    const useCase = new HandleEmailBouncedUseCase(messageRepo, runRepo, businessRepo, emailService);
    await useCase.execute({ externalMessageId: "re_abc" });

    expect(messageRepo.updateStatus).toHaveBeenCalledWith("msg-uuid", "biz-uuid", "bounced");
    expect(runRepo.stopRun).toHaveBeenCalledWith("run-uuid", "biz-uuid", "email_bounced");
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "sandra@example.com",
        subject: expect.stringContaining("Acme Corp"),
      }),
    );
  });

  it("skips silently when message is not found", async () => {
    const messageRepo: jest.Mocked<ResendEventsMessageRepository> = {
      findByExternalId: jest.fn().mockResolvedValue(null),
      updateStatus: jest.fn(),
      updateOpenedAt: jest.fn(),
      updateClickedAt: jest.fn(),
    };
    const runRepo = makeRunRepo();
    const businessRepo = makeBusinessRepo();
    const emailService = makeEmailService();

    const useCase = new HandleEmailBouncedUseCase(messageRepo, runRepo, businessRepo, emailService);
    await expect(useCase.execute({ externalMessageId: "re_unknown" })).resolves.not.toThrow();

    expect(messageRepo.updateStatus).not.toHaveBeenCalled();
    expect(runRepo.stopRun).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it("does not stop the run when sequenceRunId is null", async () => {
    const messageRepo = makeMessageRepo({ ...mockMessage, sequenceRunId: null });
    const runRepo = makeRunRepo();
    const businessRepo = makeBusinessRepo();
    const emailService = makeEmailService();

    const useCase = new HandleEmailBouncedUseCase(messageRepo, runRepo, businessRepo, emailService);
    await useCase.execute({ externalMessageId: "re_abc" });

    expect(messageRepo.updateStatus).toHaveBeenCalledWith("msg-uuid", "biz-uuid", "bounced");
    expect(runRepo.stopRun).not.toHaveBeenCalled();
  });

  it("does not fail the job when alert email send fails", async () => {
    const messageRepo = makeMessageRepo();
    const runRepo = makeRunRepo();
    const businessRepo = makeBusinessRepo();
    const emailService: jest.Mocked<EmailService> = {
      send: jest.fn().mockRejectedValue(new Error("Resend API error")),
    };

    const useCase = new HandleEmailBouncedUseCase(messageRepo, runRepo, businessRepo, emailService);
    await expect(useCase.execute({ externalMessageId: "re_abc" })).resolves.not.toThrow();

    expect(messageRepo.updateStatus).toHaveBeenCalled();
    expect(runRepo.stopRun).toHaveBeenCalled();
  });
});
