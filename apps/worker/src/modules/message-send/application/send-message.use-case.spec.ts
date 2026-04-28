import { SendMessageUseCase } from "./send-message.use-case";
import type { MessageSendRepository, RunReadyToSend } from "../domain/message-send.repository";
import type { TemplateService } from "../domain/template.service";
import type { EmailService } from "../domain/email.service";
import type { SmsService } from "../domain/sms.service";
import { ConfigService } from "@nestjs/config";

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
  ...overrides,
});

describe("SendMessageUseCase", () => {
  let useCase: SendMessageUseCase;
  let repo: jest.Mocked<MessageSendRepository>;
  let templateService: jest.Mocked<TemplateService>;
  let emailService: jest.Mocked<EmailService>;
  let smsService: jest.Mocked<SmsService>;
  let config: jest.Mocked<ConfigService>;

  beforeEach(() => {
    repo = {
      findRunsReadyToSend: jest.fn(),
      findRunById: jest.fn(),
      findNextStep: jest.fn(),
      messageExistsForRunStep: jest.fn().mockResolvedValue(false),
      createMessage: jest.fn().mockResolvedValue({ created: true }),
      updateMessageStatus: jest.fn(),
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

    config = {
      get: jest.fn().mockReturnValue("notifications@paynudge.net"),
    } as unknown as jest.Mocked<ConfigService>;

    useCase = new SendMessageUseCase(repo, templateService, emailService, smsService, config);
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
        from: "Bob Smith <notifications@paynudge.net>",
        replyTo: "bob@bobsplumbing.com",
      }),
    );
    expect(repo.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "email",
        recipientEmail: "sarah@acme.com",
        status: "queued",
      }),
    );
    expect(repo.updateMessageStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: "biz-1",
        status: "sent",
        externalMessageId: "resend-123",
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
    expect(repo.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "sms",
        recipientPhone: "+15551234567",
        status: "queued",
      }),
    );
    expect(smsService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+15551234567",
        businessId: "biz-1",
      }),
    );
    expect(repo.updateMessageStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: "biz-1",
        status: "sent",
        externalMessageId: "twilio-456",
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
    expect(repo.updateMessageStatus).toHaveBeenCalledTimes(2);
  });

  it("skips when run is not found", async () => {
    repo.findRunById.mockResolvedValue(null);

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe("run_not_found");
  });

  /**
   * REGRESSION GUARD — these tests pin the contract that SendMessageUseCase
   * silently skips any run that is not 'active'. This is the last-chance
   * safety net for the payment-detection flow: when InvoiceRepository.applyChange
   * stops a run (e.g., on payment received), an already-enqueued message-send
   * job for that run must not fire. Removing this guard would silently send a
   * "you haven't paid" email after the customer paid.
   */
  describe("regression: stopped/paused runs", () => {
    it('does not send or mutate when runStatus is "stopped"', async () => {
      const run = createMockRun({ runStatus: "stopped" });
      repo.findRunById.mockResolvedValue(run);

      const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      expect(result).toEqual({
        sent: false,
        skippedReason: "run_not_active",
        messagesSent: 0,
      });
      expect(repo.messageExistsForRunStep).not.toHaveBeenCalled();
      expect(repo.createMessage).not.toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
      expect(smsService.send).not.toHaveBeenCalled();
      expect(repo.advanceRunToNextStep).not.toHaveBeenCalled();
      expect(repo.completeRun).not.toHaveBeenCalled();
    });

    it('does not send or mutate when runStatus is "paused"', async () => {
      const run = createMockRun({ runStatus: "paused" });
      repo.findRunById.mockResolvedValue(run);

      const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      expect(result).toEqual({
        sent: false,
        skippedReason: "run_not_active",
        messagesSent: 0,
      });
      expect(repo.messageExistsForRunStep).not.toHaveBeenCalled();
      expect(repo.createMessage).not.toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
      expect(smsService.send).not.toHaveBeenCalled();
      expect(repo.advanceRunToNextStep).not.toHaveBeenCalled();
      expect(repo.completeRun).not.toHaveBeenCalled();
    });

    it('does not send or mutate when runStatus is "completed"', async () => {
      const run = createMockRun({ runStatus: "completed" });
      repo.findRunById.mockResolvedValue(run);

      const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      expect(result).toEqual({
        sent: false,
        skippedReason: "run_not_active",
        messagesSent: 0,
      });
      expect(repo.messageExistsForRunStep).not.toHaveBeenCalled();
      expect(repo.createMessage).not.toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
      expect(smsService.send).not.toHaveBeenCalled();
      expect(repo.advanceRunToNextStep).not.toHaveBeenCalled();
      expect(repo.completeRun).not.toHaveBeenCalled();
    });
  });

  it("advances the run when all channels are duplicates (work was done previously, recover from crash)", async () => {
    const run = createMockRun();
    repo.findRunById.mockResolvedValue(run);
    repo.messageExistsForRunStep.mockResolvedValue(true);
    repo.findNextStep.mockResolvedValue(null);

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe("all_duplicates");
    expect(result.messagesSent).toBe(0);
    expect(emailService.send).not.toHaveBeenCalled();
    // Even though no fresh message went out, the underlying work for this
    // step was already completed on a previous attempt — completing the run
    // here breaks the otherwise-infinite scheduler loop.
    expect(repo.completeRun).toHaveBeenCalledWith("run-1", "biz-1");
  });

  it("advances the run to the next step when all channels are duplicates and a next step exists", async () => {
    const run = createMockRun();
    repo.findRunById.mockResolvedValue(run);
    repo.messageExistsForRunStep.mockResolvedValue(true);
    repo.findNextStep.mockResolvedValue({ id: "step-2", stepOrder: 2, delayDays: 5 });

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe("all_duplicates");
    expect(repo.advanceRunToNextStep).toHaveBeenCalledWith(
      "run-1",
      "biz-1",
      "step-2",
      expect.any(Date),
    );
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

  it("does NOT advance on createMessage race condition (queued row may mean email never sent)", async () => {
    const run = createMockRun();
    repo.findRunById.mockResolvedValue(run);
    // P2002 from createMessage: a row exists for (run, step, channel) but we
    // can't tell from this signal alone whether the row is status='sent' or
    // a stale status='queued' from a crashed prior attempt. Conservatively
    // do not advance — silently advancing past a stale-queued row would mean
    // the customer never receives this follow-up.
    repo.createMessage.mockResolvedValue({ created: false });
    repo.findNextStep.mockResolvedValue(null);

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe("all_duplicates");
    expect(result.messagesSent).toBe(0);
    expect(repo.completeRun).not.toHaveBeenCalled();
    expect(repo.advanceRunToNextStep).not.toHaveBeenCalled();
  });

  it("does NOT advance when one channel is confirmed-sent and another is a race-condition duplicate", async () => {
    // The dangerous mixed case: SMS was confirmed sent (good, work done),
    // but email hit a P2002 race — could be a stale 'queued' row, meaning
    // the email never went out. We must not advance and silently lose it.
    const run = createMockRun({ stepChannel: "email_and_sms" });
    repo.findRunById.mockResolvedValue(run);
    // First call (email): not previously sent.
    // Second call (sms): previously sent → confirmed.
    repo.messageExistsForRunStep
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    // The email's createMessage hits the unique constraint (race).
    repo.createMessage.mockResolvedValueOnce({ created: false });
    repo.findNextStep.mockResolvedValue({ id: "step-2", stepOrder: 2, delayDays: 5 });

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe("all_duplicates");
    expect(emailService.send).not.toHaveBeenCalled();
    expect(smsService.send).not.toHaveBeenCalled();
    expect(repo.advanceRunToNextStep).not.toHaveBeenCalled();
    expect(repo.completeRun).not.toHaveBeenCalled();
  });

  it("skips SMS for owner alert steps and does not advance when sms-only channel", async () => {
    const run = createMockRun({ stepChannel: "sms", stepIsOwnerAlert: true });
    repo.findRunById.mockResolvedValue(run);

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe("no_recipients");
    expect(smsService.send).not.toHaveBeenCalled();
    expect(repo.createMessage).not.toHaveBeenCalled();
    expect(repo.advanceRunToNextStep).not.toHaveBeenCalled();
    expect(repo.completeRun).not.toHaveBeenCalled();
  });

  it("sends email to owner but skips SMS for email_and_sms owner alert steps", async () => {
    const run = createMockRun({ stepChannel: "email_and_sms", stepIsOwnerAlert: true });
    repo.findRunById.mockResolvedValue(run);
    repo.findNextStep.mockResolvedValue(null);

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.sent).toBe(true);
    expect(result.messagesSent).toBe(1);
    expect(emailService.send).toHaveBeenCalledWith(expect.objectContaining({ to: "bob@bobsplumbing.com" }));
    expect(smsService.send).not.toHaveBeenCalled();
    expect(repo.completeRun).toHaveBeenCalledWith("run-1", "biz-1");
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

  it("advances when email_and_sms has no email recipient and SMS is a duplicate (mixed but work was done)", async () => {
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
    // The SMS was a duplicate (work happened on a previous attempt), and the
    // email channel can't send for this run anyway. Advance to break the loop.
    expect(repo.advanceRunToNextStep).toHaveBeenCalledWith(
      "run-1",
      "biz-1",
      "step-2",
      expect.any(Date),
    );
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
