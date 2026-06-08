import { SendReplyUseCase } from "./send-reply.use-case";
import type {
  MessageRepository,
  ReplyContext,
} from "../domain/message.repository";
import type {
  OutboundEmailService,
} from "../domain/outbound-email.service";
import type { MessageDetail } from "../domain/message.entity";
import {
  CustomerHasNoEmailError,
  MessageNotFoundError,
  NoReplyToRespondToError,
  OutboundEmailSendError,
} from "../domain/message.errors";

const mkContext = (over: Partial<ReplyContext> = {}): ReplyContext => ({
  message: {
    id: "msg-1",
    subject: "Reminder: Invoice INV-001",
    sequenceRunId: "run-1",
    customerId: "cust-1",
    invoiceId: "inv-1",
    businessId: "biz-1",
    repliedAt: new Date("2026-05-17T14:00:00Z"),
  },
  customer: { id: "cust-1", contactEmail: "client@example.com" },
  business: {
    senderName: "Sandra @ Widgets Inc.",
    emailSignature: "— Sandra",
    timezone: "America/New_York",
  },
  sequenceRun: { id: "run-1", status: "paused", currentStepId: "step-3" },
  currentStep: { delayDays: 3 },
  ...over,
});

const mkDetail = (over: Partial<MessageDetail> = {}): MessageDetail => ({
  id: "new-msg-id",
  channel: "email",
  recipientEmail: "client@example.com",
  recipientPhone: null,
  subject: "Re: Reminder: Invoice INV-001",
  status: "sent",
  sentAt: new Date("2026-05-18T15:00:00Z"),
  openedAt: null,
  clickedAt: null,
  repliedAt: null,
  hasReply: false,
  customer: { id: "cust-1", companyName: "Acme Corp" },
  invoice: { id: "inv-1", invoiceNumber: "INV-001" },
  body: "Thanks for flagging this.\n\n— Sandra",
  replyBody: null,
  aiDraftResponse: null,
  sequenceRun: { id: "run-1", status: "active" },
  sequenceStep: null,
  ...over,
});

const createMockRepo = (overrides: Partial<MessageRepository> = {}): MessageRepository => ({
  findManyByFilter: jest.fn(),
  findDetailById: jest.fn().mockResolvedValue(mkDetail()),
  findReplyContext: jest.fn().mockResolvedValue(mkContext()),
  createReplyMessage: jest.fn().mockResolvedValue(undefined),
  markMessageSent: jest.fn().mockResolvedValue(undefined),
  resumeRun: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const createMockEmail = (overrides: Partial<OutboundEmailService> = {}): OutboundEmailService => ({
  send: jest.fn().mockResolvedValue({ externalMessageId: "resend-id-123" }),
  ...overrides,
});

const env = {
  NOTIFICATIONS_EMAIL: "notifications@nudge.io",
  RESEND_INBOUND_ADDRESS: "reply@reply.nudge.io",
};

describe("SendReplyUseCase", () => {
  it("sends the reply and resumes the paused sequence when resumeSequence=true", async () => {
    const repo = createMockRepo();
    const email = createMockEmail();
    const useCase = new SendReplyUseCase(repo, email, env);

    const result = await useCase.execute("msg-1", "biz-1", {
      body: "Thanks for flagging this.",
      resumeSequence: true,
    });

    expect(repo.findReplyContext).toHaveBeenCalledWith("msg-1", "biz-1");
    expect(repo.createReplyMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sequenceRunId: "run-1",
        invoiceId: "inv-1",
        customerId: "cust-1",
        businessId: "biz-1",
        recipientEmail: "client@example.com",
        subject: "Re: Reminder: Invoice INV-001",
        body: "Thanks for flagging this.<br><br>— Sandra",
      }),
    );
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Sandra @ Widgets Inc. <notifications@nudge.io>",
        replyTo: "reply@reply.nudge.io",
        to: "client@example.com",
        subject: "Re: Reminder: Invoice INV-001",
        html: "Thanks for flagging this.<br><br>— Sandra",
      }),
    );
    expect(repo.markMessageSent).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: "biz-1",
        externalMessageId: "resend-id-123",
      }),
    );
    expect(repo.resumeRun).toHaveBeenCalledWith("run-1", "biz-1", expect.any(Date));
    expect(result.id).toBe("new-msg-id");
  });

  it("does not resume the sequence when resumeSequence=false", async () => {
    const repo = createMockRepo();
    const email = createMockEmail();
    const useCase = new SendReplyUseCase(repo, email, env);

    await useCase.execute("msg-1", "biz-1", {
      body: "Thanks.",
      resumeSequence: false,
    });

    expect(repo.resumeRun).not.toHaveBeenCalled();
  });

  it("does not resume when the run is already active even if resumeSequence=true", async () => {
    const repo = createMockRepo({
      findReplyContext: jest.fn().mockResolvedValue(
        mkContext({ sequenceRun: { id: "run-1", status: "active", currentStepId: "step-3" } }),
      ),
    });
    const email = createMockEmail();
    const useCase = new SendReplyUseCase(repo, email, env);

    await useCase.execute("msg-1", "biz-1", {
      body: "Thanks.",
      resumeSequence: true,
    });

    expect(repo.resumeRun).not.toHaveBeenCalled();
  });

  it("does not resume when the run has no currentStepId (already completed/stopped)", async () => {
    const repo = createMockRepo({
      findReplyContext: jest.fn().mockResolvedValue(
        mkContext({ sequenceRun: { id: "run-1", status: "paused", currentStepId: null }, currentStep: null }),
      ),
    });
    const email = createMockEmail();
    const useCase = new SendReplyUseCase(repo, email, env);

    await useCase.execute("msg-1", "biz-1", {
      body: "Thanks.",
      resumeSequence: true,
    });

    expect(repo.resumeRun).not.toHaveBeenCalled();
  });

  it("throws MessageNotFoundError when the message doesn't exist or belongs to another business", async () => {
    const repo = createMockRepo({ findReplyContext: jest.fn().mockResolvedValue(null) });
    const email = createMockEmail();
    const useCase = new SendReplyUseCase(repo, email, env);

    await expect(
      useCase.execute("missing", "biz-1", { body: "hi", resumeSequence: false }),
    ).rejects.toThrow(MessageNotFoundError);
    expect(email.send).not.toHaveBeenCalled();
    expect(repo.createReplyMessage).not.toHaveBeenCalled();
  });

  it("throws NoReplyToRespondToError when the original message has no replied_at", async () => {
    const repo = createMockRepo({
      findReplyContext: jest.fn().mockResolvedValue(
        mkContext({ message: { ...mkContext().message, repliedAt: null } }),
      ),
    });
    const email = createMockEmail();
    const useCase = new SendReplyUseCase(repo, email, env);

    await expect(
      useCase.execute("msg-1", "biz-1", { body: "hi", resumeSequence: false }),
    ).rejects.toThrow(NoReplyToRespondToError);
    expect(email.send).not.toHaveBeenCalled();
  });

  it("throws CustomerHasNoEmailError when the customer has no contact email", async () => {
    const repo = createMockRepo({
      findReplyContext: jest.fn().mockResolvedValue(
        mkContext({ customer: { id: "cust-1", contactEmail: null } }),
      ),
    });
    const email = createMockEmail();
    const useCase = new SendReplyUseCase(repo, email, env);

    await expect(
      useCase.execute("msg-1", "biz-1", { body: "hi", resumeSequence: false }),
    ).rejects.toThrow(CustomerHasNoEmailError);
    expect(email.send).not.toHaveBeenCalled();
  });

  it("collapses Re: Re: into a single Re:", async () => {
    const repo = createMockRepo({
      findReplyContext: jest.fn().mockResolvedValue(
        mkContext({ message: { ...mkContext().message, subject: "Re: Original Subject" } }),
      ),
    });
    const email = createMockEmail();
    const useCase = new SendReplyUseCase(repo, email, env);

    await useCase.execute("msg-1", "biz-1", { body: "hi", resumeSequence: false });

    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Re: Original Subject" }),
    );
  });

  it("falls back to a generic subject when the original has no subject", async () => {
    const repo = createMockRepo({
      findReplyContext: jest.fn().mockResolvedValue(
        mkContext({ message: { ...mkContext().message, subject: null } }),
      ),
    });
    const email = createMockEmail();
    const useCase = new SendReplyUseCase(repo, email, env);

    await useCase.execute("msg-1", "biz-1", { body: "hi", resumeSequence: false });

    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Re: (no subject)" }),
    );
  });

  it("omits the signature when business.emailSignature is null", async () => {
    const repo = createMockRepo({
      findReplyContext: jest.fn().mockResolvedValue(
        mkContext({
          business: {
            senderName: "Sandra @ Widgets Inc.",
            emailSignature: null,
            timezone: "America/New_York",
          },
        }),
      ),
    });
    const email = createMockEmail();
    const useCase = new SendReplyUseCase(repo, email, env);

    await useCase.execute("msg-1", "biz-1", { body: "Just my body.", resumeSequence: false });

    // No signature — body passes through newlinesToHtml (no newlines here, unchanged)
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({ html: "Just my body." }),
    );
  });

  it("converts newlines in body and signature to <br> for HTML email", async () => {
    const repo = createMockRepo({
      findReplyContext: jest.fn().mockResolvedValue(
        mkContext({
          business: {
            senderName: "Sandra @ Widgets Inc.",
            emailSignature: "Line one\nLine two",
            timezone: "America/New_York",
          },
        }),
      ),
    });
    const email = createMockEmail();
    const useCase = new SendReplyUseCase(repo, email, env);

    await useCase.execute("msg-1", "biz-1", { body: "Hi there\n\nSecond para.", resumeSequence: false });

    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({ html: "Hi there<br><br>Second para.<br><br>Line one<br>Line two" }),
    );
  });

  it("wraps Resend failures in OutboundEmailSendError and leaves the queued row in place", async () => {
    const repo = createMockRepo();
    const email = createMockEmail({
      send: jest.fn().mockRejectedValue(new Error("Resend timeout")),
    });
    const useCase = new SendReplyUseCase(repo, email, env);

    await expect(
      useCase.execute("msg-1", "biz-1", { body: "hi", resumeSequence: false }),
    ).rejects.toThrow(OutboundEmailSendError);
    expect(repo.createReplyMessage).toHaveBeenCalled();
    expect(repo.markMessageSent).not.toHaveBeenCalled();
    expect(repo.resumeRun).not.toHaveBeenCalled();
  });
});
