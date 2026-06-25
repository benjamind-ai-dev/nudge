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
  stepSubjectTemplate: "Reminder: Invoice {{invoice_number}}",
  stepBodyTemplate: "Hi {{contact_name}}, your invoice is overdue.",
  stepSmsBodyTemplate: null,
  stepIsOwnerAlert: false,
  stepIncludePaymentLink: true,
  stepTemplateSubject: null,
  stepTemplateBody: null,
  stepTemplateSignature: null,
  stepTemplateSms: null,
  firstStepSubject: null,
  firstStepBody: null,
  firstStepIncludePaymentLink: null,
  firstStepSkip: null,
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
      runHasSentMessages: jest.fn().mockResolvedValue(false),
      createMessage: jest.fn().mockResolvedValue({ created: true }),
      updateMessageStatus: jest.fn(),
      advanceRunToNextStep: jest.fn(),
      completeRun: jest.fn(),
    };

    templateService = {
      render: jest.fn((_cacheKey, _template, data) => `Rendered: ${data.company_name}`),
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
        replyTo: "notifications@paynudge.net",
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

  it("advances on createMessage race condition to break scheduler loop", async () => {
    const run = createMockRun();
    repo.findRunById.mockResolvedValue(run);
    // P2002 from createMessage: a row exists for (run, step, channel).
    // Since we no longer delete and resend queued messages, we must advance
    // to prevent infinite re-enqueuing. The trade-off is that if the message
    // was queued but never sent (crash before Resend call), we skip the step.
    // This is better than infinite duplicate sends.
    repo.createMessage.mockResolvedValue({ created: false });
    repo.findNextStep.mockResolvedValue(null);

    const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe("all_duplicates");
    expect(result.messagesSent).toBe(0);
    expect(repo.completeRun).toHaveBeenCalledWith("run-1", "biz-1");
  });

  it("advances when one channel is confirmed-sent and another is a race-condition duplicate", async () => {
    // Both channels have message records (one confirmed via messageExistsForRunStep,
    // one via createMessage race). Since duplicates exist, we advance to break
    // the scheduler loop.
    const run = createMockRun({ stepChannel: "email_and_sms" });
    repo.findRunById.mockResolvedValue(run);
    // First call (email): not previously found by messageExistsForRunStep.
    // Second call (sms): previously found → confirmed.
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
    expect(repo.advanceRunToNextStep).toHaveBeenCalledWith(
      "run-1", "biz-1", "step-2", expect.any(Date),
    );
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

  it("appends a Pay Invoice HTML button when the step toggle is on and the invoice has a payment link", async () => {
    const run = createMockRun({
      paymentLinkUrl: "https://pay.example.com/inv-1",
      stepIncludePaymentLink: true,
    });
    repo.findRunById.mockResolvedValue(run);
    repo.findNextStep.mockResolvedValue(null);
    templateService.render.mockReturnValue("Hi Sarah, please pay your invoice.");

    await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(emailService.send).toHaveBeenCalledTimes(1);
    const sent = emailService.send.mock.calls[0][0];
    expect(sent.html).toContain("Hi Sarah, please pay your invoice.");
    expect(sent.html).toMatch(/<a [^>]*href="https:\/\/pay\.example\.com\/inv-1"[^>]*>\s*Pay Invoice\s*<\/a>/);
  });

  it("does not append the button when the step toggle is off", async () => {
    const run = createMockRun({
      paymentLinkUrl: "https://pay.example.com/inv-1",
      stepIncludePaymentLink: false,
    });
    repo.findRunById.mockResolvedValue(run);
    repo.findNextStep.mockResolvedValue(null);
    templateService.render.mockReturnValue("Body without button.");

    await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    const sent = emailService.send.mock.calls[0][0];
    expect(sent.html).toContain("Body without button.");
    expect(sent.html).not.toContain("Pay Invoice");
    expect(sent.html).not.toContain("<a href=");
  });

  it("does not append the button when paymentLinkUrl is null, but still sends the email", async () => {
    const run = createMockRun({
      paymentLinkUrl: null,
      stepIncludePaymentLink: true,
    });
    repo.findRunById.mockResolvedValue(run);
    repo.findNextStep.mockResolvedValue(null);
    templateService.render.mockReturnValue("Body with no link.");

    await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(emailService.send).toHaveBeenCalledTimes(1);
    const sent = emailService.send.mock.calls[0][0];
    expect(sent.html).toContain("Body with no link.");
    expect(sent.html).not.toContain("Pay Invoice");
  });

  it("HTML-escapes special characters in the payment link URL", async () => {
    const run = createMockRun({
      paymentLinkUrl: 'https://pay.example.com/abc?x="y"&z=<1>',
      stepIncludePaymentLink: true,
    });
    repo.findRunById.mockResolvedValue(run);
    repo.findNextStep.mockResolvedValue(null);
    templateService.render.mockReturnValue("Body.");

    await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    const sent = emailService.send.mock.calls[0][0];
    expect(sent.html).toContain("&quot;y&quot;");
    expect(sent.html).toContain("&amp;z=");
    expect(sent.html).toContain("&lt;1&gt;");
    expect(sent.html).not.toMatch(/href="[^"]*"y"/);
  });

  it("does not append the button on owner-alert steps even when toggle is on and URL is set", async () => {
    const run = createMockRun({
      paymentLinkUrl: "https://pay.example.com/inv-1",
      stepIncludePaymentLink: true,
      stepIsOwnerAlert: true,
      // Owner alerts route to businessSenderEmail; the existing factory's
      // businessSenderEmail field is already populated, no override needed.
    });
    repo.findRunById.mockResolvedValue(run);
    repo.findNextStep.mockResolvedValue(null);
    templateService.render.mockReturnValue("Internal alert body.");

    await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

    expect(emailService.send).toHaveBeenCalledTimes(1);
    const sent = emailService.send.mock.calls[0][0];
    expect(sent.html).toContain("Internal alert body.");
    expect(sent.html).not.toContain("Pay Invoice");
    expect(sent.to).toBe("bob@bobsplumbing.com"); // businessSenderEmail from factory — confirms it routed to owner
  });

  describe("newline → <br> conversion in HTML email", () => {
    it("converts \\n in the body to <br>", async () => {
      const run = createMockRun({ stepIncludePaymentLink: false, businessEmailSignature: null });
      repo.findRunById.mockResolvedValue(run);
      repo.findNextStep.mockResolvedValue(null);
      // render is called in order: subject, body (no signature)
      templateService.render
        .mockReturnValueOnce("Re: Invoice INV-001")              // subject
        .mockReturnValueOnce("Hi Sarah,\n\nYour invoice is overdue."); // body

      await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      const sent = emailService.send.mock.calls[0][0];
      expect(sent.html).toBe("Hi Sarah,<br><br>Your invoice is overdue.");
    });

    it("joins body and signature with <br><br> (not \\n\\n)", async () => {
      const run = createMockRun({
        stepIncludePaymentLink: false,
        businessEmailSignature: "Thanks,\nBob",
      });
      repo.findRunById.mockResolvedValue(run);
      repo.findNextStep.mockResolvedValue(null);
      // render is called in order: subject, body, signature
      templateService.render
        .mockReturnValueOnce("Re: Invoice INV-001") // subject
        .mockReturnValueOnce("Invoice body.")       // body
        .mockReturnValueOnce("Thanks,\nBob");       // signature

      await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      const sent = emailService.send.mock.calls[0][0];
      expect(sent.html).toBe("Invoice body.<br><br>Thanks,<br>Bob");
    });

    it("joins body and payment link button with <br><br> (not \\n\\n)", async () => {
      const run = createMockRun({
        paymentLinkUrl: "https://pay.example.com/inv-1",
        stepIncludePaymentLink: true,
        businessEmailSignature: null,
      });
      repo.findRunById.mockResolvedValue(run);
      repo.findNextStep.mockResolvedValue(null);
      // render is called in order: subject, body (no signature)
      templateService.render
        .mockReturnValueOnce("Re: Invoice INV-001") // subject
        .mockReturnValueOnce("Invoice body.");       // body

      await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      const sent = emailService.send.mock.calls[0][0];
      expect(sent.html).toMatch(/^Invoice body\.<br><br><p/);
      expect(sent.html).toContain("Pay Invoice");
    });

    it("joins body, signature, and payment link with <br><br> separators", async () => {
      const run = createMockRun({
        paymentLinkUrl: "https://pay.example.com/inv-1",
        stepIncludePaymentLink: true,
        businessEmailSignature: "— Bob",
      });
      repo.findRunById.mockResolvedValue(run);
      repo.findNextStep.mockResolvedValue(null);
      // render is called in order: subject, body, signature
      templateService.render
        .mockReturnValueOnce("Re: Invoice INV-001") // subject
        .mockReturnValueOnce("Invoice body.")       // body
        .mockReturnValueOnce("— Bob");              // signature

      await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      const sent = emailService.send.mock.calls[0][0];
      expect(sent.html).toMatch(/^Invoice body\.<br><br>— Bob<br><br><p/);
    });
  });

  describe("when the step has an attached template", () => {
    it("uses the template's subject + body + signature instead of inline content", async () => {
      const run = createMockRun({
        stepSubjectTemplate: "INLINE SUBJECT",
        stepBodyTemplate: "INLINE BODY",
        stepTemplateSubject: "Template subject {{company_name}}",
        stepTemplateBody: "Template body {{company_name}}",
        stepTemplateSignature: "Template sig",
        businessEmailSignature: "Business sig (should NOT appear when template signature present)",
      });
      repo.findRunById.mockResolvedValue(run);

      await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      const renderedSources = templateService.render.mock.calls.map((c) => c[1]);
      expect(renderedSources).toContain("Template subject {{company_name}}");
      expect(renderedSources).toContain("Template body {{company_name}}");
      expect(renderedSources).toContain("Template sig");
      expect(renderedSources).not.toContain("INLINE SUBJECT");
      expect(renderedSources).not.toContain("INLINE BODY");
      expect(renderedSources).not.toContain("Business sig (should NOT appear when template signature present)");
    });

    it("falls back to inline content when stepTemplateBody is null", async () => {
      const run = createMockRun({
        stepSubjectTemplate: "INLINE SUBJECT",
        stepBodyTemplate: "INLINE BODY",
        stepTemplateSubject: null,
        stepTemplateBody: null,
        stepTemplateSignature: null,
        businessEmailSignature: "Business sig",
      });
      repo.findRunById.mockResolvedValue(run);

      await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      const renderedSources = templateService.render.mock.calls.map((c) => c[1]);
      expect(renderedSources).toContain("INLINE SUBJECT");
      expect(renderedSources).toContain("INLINE BODY");
      expect(renderedSources).toContain("Business sig");
    });
  });

  describe("SMS template body (stepTemplateSms)", () => {
    it("renders SMS body from stepTemplateSms when set, ignoring stepSmsBodyTemplate and stepBodyTemplate", async () => {
      const run = createMockRun({
        stepChannel: "sms",
        stepSmsBodyTemplate: "INLINE SMS BODY",
        stepBodyTemplate: "INLINE FALLBACK BODY",
        stepTemplateSms: "Template SMS body {{company_name}}",
      });
      repo.findRunById.mockResolvedValue(run);
      repo.findNextStep.mockResolvedValue(null);

      await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      const renderedSources = templateService.render.mock.calls.map((c) => c[1]);
      expect(renderedSources).toContain("Template SMS body {{company_name}}");
      expect(renderedSources).not.toContain("INLINE SMS BODY");
      expect(renderedSources).not.toContain("INLINE FALLBACK BODY");
      expect(smsService.send).toHaveBeenCalled();
    });

    it("falls back to stepSmsBodyTemplate when stepTemplateSms is null", async () => {
      const run = createMockRun({
        stepChannel: "sms",
        stepSmsBodyTemplate: "INLINE SMS BODY",
        stepBodyTemplate: "INLINE FALLBACK BODY",
        stepTemplateSms: null,
      });
      repo.findRunById.mockResolvedValue(run);
      repo.findNextStep.mockResolvedValue(null);

      await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      const renderedSources = templateService.render.mock.calls.map((c) => c[1]);
      expect(renderedSources).toContain("INLINE SMS BODY");
      expect(renderedSources).not.toContain("INLINE FALLBACK BODY");
      expect(smsService.send).toHaveBeenCalled();
    });
  });

  describe("first-step overrides", () => {
    it("uses custom subject and body on first send (run-scoped cache keys)", async () => {
      const run = createMockRun({
        firstStepSubject: "Custom subject from dialog",
        firstStepBody: "Custom body from dialog",
        stepIncludePaymentLink: false,
        businessEmailSignature: null,
      });
      repo.findRunById.mockResolvedValue(run);
      repo.runHasSentMessages.mockResolvedValue(false);
      repo.findNextStep.mockResolvedValue(null);
      templateService.render
        .mockReturnValueOnce("Custom subject from dialog")  // subject
        .mockReturnValueOnce("Custom body from dialog");     // body

      await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      const calls = templateService.render.mock.calls;
      // Subject call uses run-scoped key
      expect(calls[0][0]).toBe("run-1-first-subject");
      expect(calls[0][1]).toBe("Custom subject from dialog");
      // Body call uses run-scoped key
      expect(calls[1][0]).toBe("run-1-first-body");
      expect(calls[1][1]).toBe("Custom body from dialog");
    });

    it("overrides includePaymentLink=false on first send suppresses the payment button", async () => {
      const run = createMockRun({
        firstStepIncludePaymentLink: false,
        stepIncludePaymentLink: true,  // step says include, run says don't
        paymentLinkUrl: "https://pay.example.com/inv-1",
      });
      repo.findRunById.mockResolvedValue(run);
      repo.runHasSentMessages.mockResolvedValue(false);
      repo.findNextStep.mockResolvedValue(null);
      templateService.render.mockReturnValue("Body text.");

      await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      const sent = emailService.send.mock.calls[0][0];
      expect(sent.html).not.toContain("Pay Invoice");
    });

    it("overrides includePaymentLink=true on first send adds the payment button even when step says false", async () => {
      const run = createMockRun({
        firstStepIncludePaymentLink: true,
        stepIncludePaymentLink: false,  // step says exclude, run says include
        paymentLinkUrl: "https://pay.example.com/inv-1",
        businessEmailSignature: null,
      });
      repo.findRunById.mockResolvedValue(run);
      repo.runHasSentMessages.mockResolvedValue(false);
      repo.findNextStep.mockResolvedValue(null);
      templateService.render.mockReturnValue("Body text.");

      await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      const sent = emailService.send.mock.calls[0][0];
      expect(sent.html).toContain("Pay Invoice");
    });

    it("skips first send and advances the run when firstStepSkip=true", async () => {
      const run = createMockRun({ firstStepSkip: true });
      repo.findRunById.mockResolvedValue(run);
      repo.runHasSentMessages.mockResolvedValue(false);
      repo.findNextStep.mockResolvedValue(null);

      const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      expect(result.sent).toBe(false);
      expect(result.skippedReason).toBe("first_send_skipped");
      expect(result.messagesSent).toBe(0);
      expect(emailService.send).not.toHaveBeenCalled();
      expect(repo.createMessage).not.toHaveBeenCalled();
      // Run must still advance/complete
      expect(repo.completeRun).toHaveBeenCalledWith("run-1", "biz-1");
    });

    it("skips first send and advances to next step when firstStepSkip=true and next step exists", async () => {
      const run = createMockRun({ firstStepSkip: true });
      repo.findRunById.mockResolvedValue(run);
      repo.runHasSentMessages.mockResolvedValue(false);
      repo.findNextStep.mockResolvedValue({ id: "step-2", stepOrder: 2, delayDays: 5 });

      const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      expect(result.sent).toBe(false);
      expect(result.skippedReason).toBe("first_send_skipped");
      expect(emailService.send).not.toHaveBeenCalled();
      expect(repo.advanceRunToNextStep).toHaveBeenCalledWith(
        "run-1", "biz-1", "step-2", expect.any(Date),
      );
      expect(repo.completeRun).not.toHaveBeenCalled();
    });

    it("ignores firstStepSkip on second send (runHasSentMessages=true)", async () => {
      const run = createMockRun({ firstStepSkip: true });
      repo.findRunById.mockResolvedValue(run);
      // Second send: already has messages
      repo.runHasSentMessages.mockResolvedValue(true);
      repo.findNextStep.mockResolvedValue(null);

      const result = await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      expect(result.sent).toBe(true);
      expect(emailService.send).toHaveBeenCalled();
    });

    it("ignores custom subject/body overrides on second send (uses step templates)", async () => {
      const run = createMockRun({
        firstStepSubject: "Custom subject",
        firstStepBody: "Custom body",
        stepSubjectTemplate: "Step subject template",
        stepBodyTemplate: "Step body template",
        businessEmailSignature: null,
        stepIncludePaymentLink: false,
      });
      repo.findRunById.mockResolvedValue(run);
      // Second send
      repo.runHasSentMessages.mockResolvedValue(true);
      repo.findNextStep.mockResolvedValue(null);
      templateService.render.mockReturnValue("Rendered.");

      await useCase.execute({ sequenceRunId: "run-1", businessId: "biz-1" });

      const calls = templateService.render.mock.calls;
      // Should use step-scoped keys, not run-scoped
      expect(calls[0][0]).toBe("step-1-subject");
      expect(calls[0][1]).toBe("Step subject template");
      expect(calls[1][0]).toBe("step-1-body");
      expect(calls[1][1]).toBe("Step body template");
    });
  });
});
