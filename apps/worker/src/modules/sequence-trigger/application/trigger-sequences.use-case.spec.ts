import { TriggerSequencesUseCase } from "./trigger-sequences.use-case";
import type {
  SequenceTriggerRepository,
  OverdueInvoiceRow,
} from "../domain/sequence-trigger.repository";

const NOW = new Date("2026-04-21T14:00:00Z");

const mkInvoice = (over: Partial<OverdueInvoiceRow> = {}): OverdueInvoiceRow => ({
  invoiceId: "inv-1",
  invoiceNumber: "INV-001",
  customerId: "cust-1",
  customerSequenceId: null,
  customerTierId: "tier-1",
  customerTierSequenceId: "seq-1",
  dueDate: new Date("2026-04-15"),
  businessId: "biz-1",
  businessTimezone: "America/New_York",
  ...over,
});

const createMockRepo = (
  overrides: Partial<SequenceTriggerRepository> = {},
): SequenceTriggerRepository => ({
  findOverdueInvoicesWithoutRun: jest.fn().mockResolvedValue([]),
  findDefaultTierSequenceId: jest.fn().mockResolvedValue(null),
  findSequenceFirstStep: jest.fn().mockResolvedValue({ firstStepId: "step-1", firstStepDelayDays: 0 }),
  createSequenceRun: jest.fn().mockResolvedValue({ created: true, runId: "run-1" }),
  ...overrides,
});

describe("TriggerSequencesUseCase", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses customer direct sequenceId when set", async () => {
    const invoice = mkInvoice({ customerSequenceId: "direct-seq", customerTierSequenceId: "tier-seq" });

    const repo = createMockRepo({
      findOverdueInvoicesWithoutRun: jest.fn().mockResolvedValue([invoice]),
    });

    const useCase = new TriggerSequencesUseCase(repo);
    await useCase.execute();

    expect(repo.findSequenceFirstStep).toHaveBeenCalledWith("direct-seq");
    expect(repo.findDefaultTierSequenceId).not.toHaveBeenCalled();
  });

  it("falls back to tier sequenceId when customer has no direct sequence", async () => {
    const invoice = mkInvoice({ customerSequenceId: null, customerTierSequenceId: "tier-seq" });

    const repo = createMockRepo({
      findOverdueInvoicesWithoutRun: jest.fn().mockResolvedValue([invoice]),
    });

    const useCase = new TriggerSequencesUseCase(repo);
    await useCase.execute();

    expect(repo.findSequenceFirstStep).toHaveBeenCalledWith("tier-seq");
    expect(repo.findDefaultTierSequenceId).not.toHaveBeenCalled();
  });

  it("falls back to default tier when customer and tier sequence are null", async () => {
    const invoice = mkInvoice({ customerSequenceId: null, customerTierSequenceId: null });

    const repo = createMockRepo({
      findOverdueInvoicesWithoutRun: jest.fn().mockResolvedValue([invoice]),
      findDefaultTierSequenceId: jest.fn().mockResolvedValue("default-seq"),
    });

    const useCase = new TriggerSequencesUseCase(repo);
    await useCase.execute();

    expect(repo.findDefaultTierSequenceId).toHaveBeenCalledWith("biz-1");
    expect(repo.findSequenceFirstStep).toHaveBeenCalledWith("default-seq");
  });

  it("skips invoice with no_active_sequence when no sequence resolves", async () => {
    const invoice = mkInvoice({ customerSequenceId: null, customerTierSequenceId: null });

    const repo = createMockRepo({
      findOverdueInvoicesWithoutRun: jest.fn().mockResolvedValue([invoice]),
      findDefaultTierSequenceId: jest.fn().mockResolvedValue(null),
    });

    const useCase = new TriggerSequencesUseCase(repo);
    const result = await useCase.execute();

    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toBe("no_active_sequence");
    expect(repo.createSequenceRun).not.toHaveBeenCalled();
  });

  it("skips invoice with no_steps when sequence exists but has no steps", async () => {
    const invoice = mkInvoice({ customerTierSequenceId: "seq-1" });

    const repo = createMockRepo({
      findOverdueInvoicesWithoutRun: jest.fn().mockResolvedValue([invoice]),
      findSequenceFirstStep: jest.fn().mockResolvedValue(null),
    });

    const useCase = new TriggerSequencesUseCase(repo);
    const result = await useCase.execute();

    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toBe("no_steps");
    expect(repo.createSequenceRun).not.toHaveBeenCalled();
  });

  it("creates sequence run with correct data", async () => {
    const invoice = mkInvoice({ customerTierSequenceId: "seq-1" });

    const repo = createMockRepo({
      findOverdueInvoicesWithoutRun: jest.fn().mockResolvedValue([invoice]),
      findSequenceFirstStep: jest.fn().mockResolvedValue({ firstStepId: "step-1", firstStepDelayDays: 0 }),
      createSequenceRun: jest.fn().mockResolvedValue({ created: true, runId: "run-1" }),
    });

    const useCase = new TriggerSequencesUseCase(repo);
    const result = await useCase.execute();

    expect(result.runsCreated).toBe(1);
    expect(repo.createSequenceRun).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: "inv-1",
        sequenceId: "seq-1",
        currentStepId: "step-1",
        status: "active",
      }),
    );
  });

  it("processes invoices in batches", async () => {
    const batch1 = Array.from({ length: 100 }, (_, i) =>
      mkInvoice({ invoiceId: `inv-${i}`, invoiceNumber: `INV-${i}` }),
    );
    const batch2 = [mkInvoice({ invoiceId: "inv-100", invoiceNumber: "INV-100" })];

    const repo = createMockRepo({
      findOverdueInvoicesWithoutRun: jest
        .fn()
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2),
    });

    const useCase = new TriggerSequencesUseCase(repo);
    const result = await useCase.execute();

    expect(result.invoicesProcessed).toBe(101);
    expect(repo.findOverdueInvoicesWithoutRun).toHaveBeenCalledTimes(2);
  });
});
