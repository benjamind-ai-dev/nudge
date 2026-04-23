import { SendMessageUseCase } from "./send-message.use-case";
import type { MessageSendRepository, RunReadyToSend } from "../domain/message-send.repository";
import type { TemplateService } from "../domain/template.service";
import type { EmailService } from "../domain/email.service";
import type { SmsService } from "../domain/sms.service";

const createMockRun = (overrides: Partial<RunReadyToSend> = {}): RunReadyToSend => ({
  runId: "run-1",
  runStatus: "active",
  invoiceId: "inv-1",
  invoiceNumber: "INV-001",
  amountCents: 100000,
  balanceDueCents: 100000,
  dueDate: new Date("2026-04-10"),
  paymentLinkUrl: "https://pay.example.com/inv-1",
  customerId: "cust-1",
  customerCompanyName: "Acme Corp",
  customerContactName: "Sarah",
  customerContactEmail: "sarah@acme.com",
  customerContactPhone: "+15551234567",
  businessId: "biz-1",
  businessName: "Bob's Plumbing",
  businessSenderName: "Bob Smith",
  businessSenderEmail: "bob@bobsplumbing.com",
  businessEmailSignature: "Thanks, Bob",
  businessTimezone: "America/New_York",
  sequenceId: "seq-1",
  stepId: "step-1",
  stepOrder: 1,
  stepChannel: "email",
  stepSubjectTemplate: "Reminder: Invoice {{invoice.invoice_number}}",
  stepBodyTemplate: "Hi {{customer.contact_name}}, your invoice is overdue.",
  stepSmsBodyTemplate: null,
  stepIsOwnerAlert: false,
  stepDelayDays: 3,
  ...overrides,
});

describe("SendMessageUseCase", () => {
  let useCase: SendMessageUseCase;
  let repo: jest.Mocked<MessageSendRepository>;
  let templateService: jest.Mocked<TemplateService>;
  let emailService: jest.Mocked<EmailService>;
  let smsService: jest.Mocked<SmsService>;

  beforeEach(() => {
    repo = {
      findRunsReadyToSend: jest.fn(),
      findRunById: jest.fn(),
      findNextStep: jest.fn(),
      messageExistsForRunStep: jest.fn().mockResolvedValue(false),
      createMessage: jest.fn().mockResolvedValue({ created: true }),
      advanceRunToNextStep: jest.fn(),
      completeRun: jest.fn(),
    };

    templateService = {
      render: jest.fn((_cacheKey, _template, data) => `Rendered: ${data.customer.company_name}`),
    };

    emailService = {
      send: jest.fn().mockResolvedValue({ externalMessageId: "resend-123" }),
    };

    smsService = {
      send: jest.fn().mockResolvedValue({ externalMessageId: "twilio-456" }),
    };

    useCase = new SendMessageUseCase(repo, templateService, emailService, smsService);
  });

  it("sends email and advances to next step", async () => {
    const run = createMockRun();
    repo.findRunById.mockResolvedValue(run);
    repo.findNextStep.mockResolvedValue({ id: "step-2", stepOrder: 2, delayDays: 5 });

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.sent).toBe(true);
    expect(result.messagesSent).toBe(1);
    expect(repo.findRunById).toHaveBeenCalledWith("run-1", "biz-1");
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "sarah@acme.com",
        from: "Bob Smith <bob@bobsplumbing.com>",
      }),
    );
    expect(repo.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "email",
        recipientEmail: "sarah@acme.com",
        status: "sent",
      }),
    );
    expect(repo.advanceRunToNextStep).toHaveBeenCalledWith(
      "run-1",
      "biz-1",
      "step-2",
      expect.any(Date),
    );
  });

  it("sends SMS when channel is sms", async () => {
    const run = createMockRun({ stepChannel: "sms" });
    repo.findRunById.mockResolvedValue(run);
    repo.findNextStep.mockResolvedValue(null);

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.sent).toBe(true);
    expect(smsService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+15551234567",
        businessId: "biz-1",
      }),
    );
    expect(repo.completeRun).toHaveBeenCalledWith("run-1", "biz-1");
  });

  it("sends both email and SMS for email_and_sms channel", async () => {
    const run = createMockRun({ stepChannel: "email_and_sms" });
    repo.findRunById.mockResolvedValue(run);
    repo.findNextStep.mockResolvedValue(null);

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.messagesSent).toBe(2);
    expect(emailService.send).toHaveBeenCalled();
    expect(smsService.send).toHaveBeenCalled();
    expect(repo.createMessage).toHaveBeenCalledTimes(2);
  });

  it("skips when run is not found", async () => {
    repo.findRunById.mockResolvedValue(null);

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe("run_not_found");
  });

  it("skips when run is no longer active", async () => {
    const run = createMockRun({ runStatus: "completed" });
    repo.findRunById.mockResolvedValue(run);

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe("run_not_active");
  });

  it("skips duplicate message and does not advance when all channels are duplicates", async () => {
    const run = createMockRun();
    repo.findRunById.mockResolvedValue(run);
    repo.messageExistsForRunStep.mockResolvedValue(true);
    repo.findNextStep.mockResolvedValue(null);

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe("all_duplicates");
    expect(result.messagesSent).toBe(0);
    expect(emailService.send).not.toHaveBeenCalled();
    expect(repo.advanceRunToNextStep).not.toHaveBeenCalled();
    expect(repo.completeRun).not.toHaveBeenCalled();
  });

  it("skips email and does not advance when no recipient email", async () => {
    const run = createMockRun({ customerContactEmail: null });
    repo.findRunById.mockResolvedValue(run);
    repo.findNextStep.mockResolvedValue({ id: "step-2", stepOrder: 2, delayDays: 5 });

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe("no_recipients");
    expect(result.messagesSent).toBe(0);
    expect(emailService.send).not.toHaveBeenCalled();
    expect(repo.advanceRunToNextStep).not.toHaveBeenCalled();
    expect(repo.completeRun).not.toHaveBeenCalled();
  });

  it("handles duplicate race condition from createMessage", async () => {
    const run = createMockRun();
    repo.findRunById.mockResolvedValue(run);
    repo.createMessage.mockResolvedValue({ created: false });
    repo.findNextStep.mockResolvedValue(null);

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe("all_duplicates");
    expect(result.messagesSent).toBe(0);
    expect(repo.completeRun).not.toHaveBeenCalled();
  });

  it("sends to owner email when isOwnerAlert is true", async () => {
    const run = createMockRun({ stepIsOwnerAlert: true });
    repo.findRunById.mockResolvedValue(run);
    repo.findNextStep.mockResolvedValue(null);

    await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "bob@bobsplumbing.com",
      }),
    );
  });

  it("completes run when no next step exists", async () => {
    const run = createMockRun();
    repo.findRunById.mockResolvedValue(run);
    repo.findNextStep.mockResolvedValue(null);

    await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(repo.completeRun).toHaveBeenCalledWith("run-1", "biz-1");
    expect(repo.advanceRunToNextStep).not.toHaveBeenCalled();
  });

  it("does not advance when email_and_sms has no email recipient and SMS is duplicate", async () => {
    const run = createMockRun({
      stepChannel: "email_and_sms",
      customerContactEmail: null,
    });
    repo.findRunById.mockResolvedValue(run);
    repo.messageExistsForRunStep
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    repo.findNextStep.mockResolvedValue({ id: "step-2", stepOrder: 2, delayDays: 5 });

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe("all_skipped_mixed");
    expect(result.messagesSent).toBe(0);
    expect(emailService.send).not.toHaveBeenCalled();
    expect(smsService.send).not.toHaveBeenCalled();
    expect(repo.advanceRunToNextStep).not.toHaveBeenCalled();
  });

  it("sends SMS but not email when email_and_sms has no email recipient", async () => {
    const run = createMockRun({
      stepChannel: "email_and_sms",
      customerContactEmail: null,
    });
    repo.findRunById.mockResolvedValue(run);
    repo.findNextStep.mockResolvedValue(null);

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.sent).toBe(true);
    expect(result.messagesSent).toBe(1);
    expect(emailService.send).not.toHaveBeenCalled();
    expect(smsService.send).toHaveBeenCalled();
    expect(repo.completeRun).toHaveBeenCalledWith("run-1", "biz-1");
  });
});
