import { TriggerSequencesUseCase } from "./trigger-sequences.use-case";
import type {
  SequenceTriggerRepository,
  OverdueInvoiceRow,
  TierWithSequence,
} from "../domain/sequence-trigger.repository";

const NOW = new Date("2026-04-21T14:00:00Z");

const mkInvoice = (over: Partial<OverdueInvoiceRow> = {}): OverdueInvoiceRow => ({
  invoiceId: "inv-1",
  invoiceNumber: "INV-001",
  customerId: "cust-1",
  customerTierId: "tier-1",
  dueDate: new Date("2026-04-15"),
  businessId: "biz-1",
  businessTimezone: "America/New_York",
  ...over,
});

const mkTierWithSequence = (over: Partial<TierWithSequence> = {}): TierWithSequence => ({
  tierId: "tier-1",
  tierName: "Standard",
  sequenceId: "seq-1",
  firstStepId: "step-1",
  firstStepDelayDays: 0,
  ...over,
});

const createMockRepo = (
  overrides: Partial<SequenceTriggerRepository> = {},
): SequenceTriggerRepository => ({
  findOverdueInvoicesWithoutRun: jest.fn().mockResolvedValue([]),
  findDefaultTier: jest.fn().mockResolvedValue(null),
  findActiveSequenceForTier: jest.fn().mockResolvedValue(null),
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

  it("creates sequence run for overdue invoice with tier", async () => {
    const invoice = mkInvoice();
    const tierData = mkTierWithSequence();

    const repo = createMockRepo({
      findOverdueInvoicesWithoutRun: jest.fn().mockResolvedValue([invoice]),
      findActiveSequenceForTier: jest.fn().mockResolvedValue(tierData),
      createSequenceRun: jest.fn().mockResolvedValue({ created: true, runId: "run-1" }),
    });

    const useCase = new TriggerSequencesUseCase(repo);
    const result = await useCase.execute();

    expect(result.invoicesProcessed).toBe(1);
    expect(result.runsCreated).toBe(1);
    expect(result.skipped).toHaveLength(0);
    expect(repo.createSequenceRun).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: "inv-1",
        sequenceId: "seq-1",
        currentStepId: "step-1",
        status: "active",
      }),
    );
  });

  it("uses default tier when customer has no tier", async () => {
    const invoice = mkInvoice({ customerTierId: null });
    const tierData = mkTierWithSequence({ tierId: "default-tier" });

    const repo = createMockRepo({
      findOverdueInvoicesWithoutRun: jest.fn().mockResolvedValue([invoice]),
      findDefaultTier: jest.fn().mockResolvedValue({ id: "default-tier", name: "Default" }),
      findActiveSequenceForTier: jest.fn().mockResolvedValue(tierData),
      createSequenceRun: jest.fn().mockResolvedValue({ created: true, runId: "run-1" }),
    });

    const useCase = new TriggerSequencesUseCase(repo);
    const result = await useCase.execute();

    expect(result.invoicesProcessed).toBe(1);
    expect(result.runsCreated).toBe(1);
    expect(repo.findDefaultTier).toHaveBeenCalledWith("biz-1");
    expect(repo.findActiveSequenceForTier).toHaveBeenCalledWith("default-tier");
  });

  it("skips and logs error when no tier and no default", async () => {
    const invoice = mkInvoice({ customerTierId: null });

    const repo = createMockRepo({
      findOverdueInvoicesWithoutRun: jest.fn().mockResolvedValue([invoice]),
      findDefaultTier: jest.fn().mockResolvedValue(null),
    });

    const useCase = new TriggerSequencesUseCase(repo);
    const result = await useCase.execute();

    expect(result.invoicesProcessed).toBe(1);
    expect(result.runsCreated).toBe(0);
    expect(result.skipped).toEqual([{ invoiceId: "inv-1", reason: "no_tier" }]);
    expect(repo.createSequenceRun).not.toHaveBeenCalled();
  });

  it("skips and logs warning when no active sequence for tier", async () => {
    const invoice = mkInvoice();

    const repo = createMockRepo({
      findOverdueInvoicesWithoutRun: jest.fn().mockResolvedValue([invoice]),
      findActiveSequenceForTier: jest.fn().mockResolvedValue(null),
      findDefaultTier: jest.fn().mockResolvedValue({ id: "tier-1", name: "Standard" }),
    });

    const useCase = new TriggerSequencesUseCase(repo);
    const result = await useCase.execute();

    expect(result.invoicesProcessed).toBe(1);
    expect(result.runsCreated).toBe(0);
    expect(result.skipped).toEqual([{ invoiceId: "inv-1", reason: "no_active_sequence" }]);
    expect(repo.createSequenceRun).not.toHaveBeenCalled();
  });

  it("does not count run as created if race condition (createSequenceRun returns false)", async () => {
    const invoice = mkInvoice();
    const tierData = mkTierWithSequence();

    const repo = createMockRepo({
      findOverdueInvoicesWithoutRun: jest.fn().mockResolvedValue([invoice]),
      findActiveSequenceForTier: jest.fn().mockResolvedValue(tierData),
      createSequenceRun: jest.fn().mockResolvedValue({ created: false, runId: null }),
    });

    const useCase = new TriggerSequencesUseCase(repo);
    const result = await useCase.execute();

    expect(result.invoicesProcessed).toBe(1);
    expect(result.runsCreated).toBe(0);
    expect(result.skipped).toHaveLength(0);
  });

  it("processes multiple batches when there are more invoices than batch size", async () => {
    const invoices = Array.from({ length: 150 }, (_, i) =>
      mkInvoice({ invoiceId: `inv-${i}`, invoiceNumber: `INV-${i}` }),
    );

    const tierData = mkTierWithSequence();

    const repo = createMockRepo({
      findOverdueInvoicesWithoutRun: jest
        .fn()
        .mockResolvedValueOnce(invoices.slice(0, 100))
        .mockResolvedValueOnce(invoices.slice(100)),
      findActiveSequenceForTier: jest.fn().mockResolvedValue(tierData),
      createSequenceRun: jest.fn().mockResolvedValue({ created: true, runId: "run-1" }),
    });

    const useCase = new TriggerSequencesUseCase(repo);
    const result = await useCase.execute();

    expect(result.invoicesProcessed).toBe(150);
    expect(result.runsCreated).toBe(150);
    expect(repo.findOverdueInvoicesWithoutRun).toHaveBeenCalledTimes(2);
  });
});
