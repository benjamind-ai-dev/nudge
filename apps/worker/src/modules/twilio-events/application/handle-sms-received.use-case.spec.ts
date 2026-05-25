import { HandleSmsReceivedUseCase, toDigits } from "./handle-sms-received.use-case";
import type {
  TwilioEventsCustomerRepository,
  TwilioEventsSequenceRunRepository,
  TwilioEventsBusinessRepository,
} from "../domain/twilio-events.repositories";
import type { EmailService } from "../../message-send/domain/email.service";

function makeDeps(overrides: {
  runs?: Array<{ runId: string; businessId: string; companyName: string }>;
  ownerEmail?: string | null;
  sendRejects?: Error;
  stopRunResult?: boolean;
} = {}) {
  const customerRepo: jest.Mocked<TwilioEventsCustomerRepository> = {
    findActiveRunsByContactPhone: jest.fn().mockResolvedValue(overrides.runs ?? []),
  };
  const runRepo: jest.Mocked<TwilioEventsSequenceRunRepository> = {
    stopRun: jest.fn().mockResolvedValue(overrides.stopRunResult ?? true),
  };
  const businessRepo: jest.Mocked<TwilioEventsBusinessRepository> = {
    findWithOwner: jest.fn().mockResolvedValue(
      overrides.ownerEmail === null
        ? null
        : { name: "Acme", ownerEmail: overrides.ownerEmail ?? "owner@example.com" },
    ),
  };
  const emailService: jest.Mocked<EmailService> = {
    send: overrides.sendRejects
      ? jest.fn().mockRejectedValue(overrides.sendRejects)
      : jest.fn().mockResolvedValue({ externalMessageId: "ext-1" }),
  };

  const uc = new HandleSmsReceivedUseCase(
    customerRepo,
    runRepo,
    businessRepo,
    emailService,
  );

  return { uc, customerRepo, runRepo, businessRepo, emailService };
}

describe("toDigits", () => {
  it("strips non-digit characters", () => {
    expect(toDigits("+1 (555) 123-4567")).toBe("15551234567");
    expect(toDigits("(555) 123-4567")).toBe("5551234567");
    expect(toDigits("")).toBe("");
  });
});

describe("HandleSmsReceivedUseCase", () => {
  it("returns early when phone has no digits", async () => {
    const deps = makeDeps();
    await deps.uc.execute({ fromPhone: "", replyBody: "hi" });
    expect(deps.customerRepo.findActiveRunsByContactPhone).not.toHaveBeenCalled();
    expect(deps.runRepo.stopRun).not.toHaveBeenCalled();
  });

  it("normalizes phone to digits before lookup", async () => {
    const deps = makeDeps();
    await deps.uc.execute({ fromPhone: "+1 (555) 123-4567", replyBody: "ok" });
    expect(deps.customerRepo.findActiveRunsByContactPhone).toHaveBeenCalledWith(
      "15551234567",
    );
  });

  it("returns early when no active runs match the sender phone", async () => {
    const deps = makeDeps({ runs: [] });
    await deps.uc.execute({ fromPhone: "+15551234567", replyBody: "hi" });
    expect(deps.runRepo.stopRun).not.toHaveBeenCalled();
    expect(deps.emailService.send).not.toHaveBeenCalled();
  });

  it("for each active run: stops it with client_replied and alerts the owner", async () => {
    const deps = makeDeps({
      runs: [{ runId: "run-1", businessId: "biz-1", companyName: "Midwest Plastics" }],
    });

    await deps.uc.execute({ fromPhone: "+15551234567", replyBody: "we dispute this" });

    expect(deps.runRepo.stopRun).toHaveBeenCalledWith("run-1", "biz-1", "client_replied");
    expect(deps.emailService.send).toHaveBeenCalledTimes(1);
  });

  it("does not send an alert when the business has no owner record", async () => {
    const deps = makeDeps({
      runs: [{ runId: "run-1", businessId: "biz-1", companyName: "Midwest Plastics" }],
      ownerEmail: null,
    });

    await deps.uc.execute({ fromPhone: "+15551234567", replyBody: "ok" });

    expect(deps.runRepo.stopRun).toHaveBeenCalledTimes(1);
    expect(deps.emailService.send).not.toHaveBeenCalled();
  });

  it("continues processing when alert email send fails (does not throw)", async () => {
    const deps = makeDeps({
      runs: [{ runId: "run-1", businessId: "biz-1", companyName: "Midwest Plastics" }],
      sendRejects: new Error("resend down"),
    });

    await expect(
      deps.uc.execute({ fromPhone: "+15551234567", replyBody: "hello" }),
    ).resolves.toBeUndefined();

    expect(deps.runRepo.stopRun).toHaveBeenCalled();
  });

  it("stops all matching runs", async () => {
    const deps = makeDeps({
      runs: [
        { runId: "run-1", businessId: "biz-1", companyName: "First" },
        { runId: "run-2", businessId: "biz-2", companyName: "Second" },
      ],
    });

    await deps.uc.execute({ fromPhone: "+15551234567", replyBody: "hi" });

    expect(deps.runRepo.stopRun).toHaveBeenCalledTimes(2);
    expect(deps.emailService.send).toHaveBeenCalledTimes(2);
  });

  it("skips the owner alert when stopRun returns false (run already terminal)", async () => {
    const deps = makeDeps({
      runs: [{ runId: "run-1", businessId: "biz-1", companyName: "Midwest Plastics" }],
      stopRunResult: false,
    });

    await deps.uc.execute({ fromPhone: "+15551234567", replyBody: "ok" });

    expect(deps.runRepo.stopRun).toHaveBeenCalledTimes(1);
    expect(deps.businessRepo.findWithOwner).not.toHaveBeenCalled();
    expect(deps.emailService.send).not.toHaveBeenCalled();
  });
});
