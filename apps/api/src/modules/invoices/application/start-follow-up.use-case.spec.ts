import { StartFollowUpUseCase } from "./start-follow-up.use-case";
import type {
  FollowUpContext,
  StartFollowUpRepository,
} from "../domain/start-follow-up.repository";
import {
  InvoiceNotFoundError,
  InvoiceNotChaseableError,
  NoActiveSequenceError,
  NoStepsError,
} from "../domain/invoice.errors";

const INVOICE_ID = "11111111-1111-1111-1111-111111111111";
const BUSINESS_ID = "22222222-2222-2222-2222-222222222222";

function baseContext(overrides: Partial<FollowUpContext> = {}): FollowUpContext {
  return {
    status: "overdue",
    dueDate: new Date("2099-01-10T00:00:00Z"),
    businessTimezone: "America/New_York",
    customerId: "33333333-3333-3333-3333-333333333333",
    customerSequenceId: null,
    customerSequenceIsActive: null,
    customerTierSequenceId: null,
    customerTierSequenceIsActive: null,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<StartFollowUpRepository> = {}): StartFollowUpRepository {
  return {
    getFollowUpContext: jest.fn().mockResolvedValue(baseContext()),
    findDefaultTierSequenceId: jest.fn().mockResolvedValue("seq-default"),
    findAnyActiveSequenceId: jest.fn().mockResolvedValue("seq-any"),
    findSequenceFirstStep: jest
      .fn()
      .mockResolvedValue({ firstStepId: "step-1", firstStepDelayDays: 0 }),
    createSequenceRun: jest.fn().mockResolvedValue({ created: true, runId: "run-1" }),
    ...overrides,
  };
}

describe("StartFollowUpUseCase", () => {
  it("creates a run on the business default sequence (happy path)", async () => {
    const repo = makeRepo();
    const useCase = new StartFollowUpUseCase(repo);

    const result = await useCase.execute(INVOICE_ID, BUSINESS_ID);

    expect(result).toEqual({ runId: "run-1", created: true, status: "active" });
    expect(repo.createSequenceRun).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: INVOICE_ID,
        businessId: BUSINESS_ID,
        sequenceId: "seq-default",
        currentStepId: "step-1",
        status: "active",
        firstStepSubject: null,
        firstStepBody: null,
        firstStepIncludePaymentLink: null,
        firstStepSkip: null,
      }),
    );
  });

  it("prefers an active customer override sequence", async () => {
    const repo = makeRepo({
      getFollowUpContext: jest.fn().mockResolvedValue(
        baseContext({ customerSequenceId: "seq-override", customerSequenceIsActive: true }),
      ),
    });
    const useCase = new StartFollowUpUseCase(repo);

    await useCase.execute(INVOICE_ID, BUSINESS_ID);

    expect(repo.createSequenceRun).toHaveBeenCalledWith(
      expect.objectContaining({ sequenceId: "seq-override" }),
    );
    expect(repo.findDefaultTierSequenceId).not.toHaveBeenCalled();
  });

  it("uses the customer tier sequence when active", async () => {
    const repo = makeRepo({
      getFollowUpContext: jest.fn().mockResolvedValue(
        baseContext({ customerTierSequenceId: "seq-tier", customerTierSequenceIsActive: true }),
      ),
    });
    const useCase = new StartFollowUpUseCase(repo);

    await useCase.execute(INVOICE_ID, BUSINESS_ID);

    expect(repo.createSequenceRun).toHaveBeenCalledWith(
      expect.objectContaining({ sequenceId: "seq-tier" }),
    );
  });

  it("falls back to the business default when the customer tier sequence is inactive", async () => {
    // The manual start never refuses for a paused tier sequence — it falls
    // through to the business default instead of throwing.
    const repo = makeRepo({
      getFollowUpContext: jest.fn().mockResolvedValue(
        baseContext({ customerTierSequenceId: "seq-tier", customerTierSequenceIsActive: false }),
      ),
    });
    const useCase = new StartFollowUpUseCase(repo);

    await useCase.execute(INVOICE_ID, BUSINESS_ID);

    expect(repo.createSequenceRun).toHaveBeenCalledWith(
      expect.objectContaining({ sequenceId: "seq-default" }),
    );
  });

  it("falls back to any active sequence when there is no default tier sequence", async () => {
    const repo = makeRepo({
      findDefaultTierSequenceId: jest.fn().mockResolvedValue(null),
    });
    const useCase = new StartFollowUpUseCase(repo);

    await useCase.execute(INVOICE_ID, BUSINESS_ID);

    expect(repo.createSequenceRun).toHaveBeenCalledWith(
      expect.objectContaining({ sequenceId: "seq-any" }),
    );
  });

  it("falls through to tier sequence when override is present but inactive", async () => {
    // override present but inactive → skip override
    // tier sequence present and active → use tier sequence
    const repo = makeRepo({
      getFollowUpContext: jest.fn().mockResolvedValue(
        baseContext({
          customerSequenceId: "seq-override",
          customerSequenceIsActive: false,
          customerTierSequenceId: "seq-tier",
          customerTierSequenceIsActive: true,
        }),
      ),
    });
    const useCase = new StartFollowUpUseCase(repo);

    await useCase.execute(INVOICE_ID, BUSINESS_ID);

    expect(repo.createSequenceRun).toHaveBeenCalledWith(
      expect.objectContaining({ sequenceId: "seq-tier" }),
    );
    expect(repo.findDefaultTierSequenceId).not.toHaveBeenCalled();
  });

  it("returns already_running when a run already exists (dedup)", async () => {
    const repo = makeRepo({
      createSequenceRun: jest.fn().mockResolvedValue({ created: false, runId: null }),
    });
    const useCase = new StartFollowUpUseCase(repo);

    const result = await useCase.execute(INVOICE_ID, BUSINESS_ID);

    expect(result).toEqual({ runId: null, created: false, status: "already_running" });
  });

  it("throws InvoiceNotFoundError when the invoice is missing", async () => {
    const repo = makeRepo({ getFollowUpContext: jest.fn().mockResolvedValue(null) });
    const useCase = new StartFollowUpUseCase(repo);

    await expect(useCase.execute(INVOICE_ID, BUSINESS_ID)).rejects.toBeInstanceOf(
      InvoiceNotFoundError,
    );
  });

  it("throws InvoiceNotChaseableError for paid/voided invoices", async () => {
    const repo = makeRepo({
      getFollowUpContext: jest.fn().mockResolvedValue(baseContext({ status: "paid" })),
    });
    const useCase = new StartFollowUpUseCase(repo);

    await expect(useCase.execute(INVOICE_ID, BUSINESS_ID)).rejects.toBeInstanceOf(
      InvoiceNotChaseableError,
    );
  });

  it("throws NoActiveSequenceError only when the business has zero active sequences", async () => {
    const repo = makeRepo({
      findDefaultTierSequenceId: jest.fn().mockResolvedValue(null),
      findAnyActiveSequenceId: jest.fn().mockResolvedValue(null),
    });
    const useCase = new StartFollowUpUseCase(repo);

    await expect(useCase.execute(INVOICE_ID, BUSINESS_ID)).rejects.toBeInstanceOf(
      NoActiveSequenceError,
    );
  });

  it("throws NoStepsError when the resolved sequence has no steps", async () => {
    const repo = makeRepo({ findSequenceFirstStep: jest.fn().mockResolvedValue(null) });
    const useCase = new StartFollowUpUseCase(repo);

    await expect(useCase.execute(INVOICE_ID, BUSINESS_ID)).rejects.toBeInstanceOf(NoStepsError);
  });

  describe("opts mapping", () => {
    it("maps subject, body, includePaymentLink to run create data", async () => {
      const repo = makeRepo();
      const useCase = new StartFollowUpUseCase(repo);

      await useCase.execute(INVOICE_ID, BUSINESS_ID, {
        subject: "Custom subject",
        body: "Custom body text",
        includePaymentLink: false,
      });

      expect(repo.createSequenceRun).toHaveBeenCalledWith(
        expect.objectContaining({
          firstStepSubject: "Custom subject",
          firstStepBody: "Custom body text",
          firstStepIncludePaymentLink: false,
          firstStepSkip: null,
        }),
      );
    });

    it("sets firstStepSkip=true when sendByEmail is false", async () => {
      const repo = makeRepo();
      const useCase = new StartFollowUpUseCase(repo);

      await useCase.execute(INVOICE_ID, BUSINESS_ID, { sendByEmail: false });

      expect(repo.createSequenceRun).toHaveBeenCalledWith(
        expect.objectContaining({
          firstStepSkip: true,
          firstStepSubject: null,
          firstStepBody: null,
          firstStepIncludePaymentLink: null,
        }),
      );
    });

    it("sets firstStepSkip=null when sendByEmail is true", async () => {
      const repo = makeRepo();
      const useCase = new StartFollowUpUseCase(repo);

      await useCase.execute(INVOICE_ID, BUSINESS_ID, { sendByEmail: true });

      expect(repo.createSequenceRun).toHaveBeenCalledWith(
        expect.objectContaining({ firstStepSkip: null }),
      );
    });

    it("sets all fields to null when no opts provided (default behavior unchanged)", async () => {
      const repo = makeRepo();
      const useCase = new StartFollowUpUseCase(repo);

      await useCase.execute(INVOICE_ID, BUSINESS_ID);

      expect(repo.createSequenceRun).toHaveBeenCalledWith(
        expect.objectContaining({
          firstStepSubject: null,
          firstStepBody: null,
          firstStepIncludePaymentLink: null,
          firstStepSkip: null,
        }),
      );
    });
  });
});
