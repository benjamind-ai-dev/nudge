import { ActivateSequenceUseCase } from "./activate-sequence.use-case";
import type { SequenceRepository } from "../domain/sequence.repository";
import type { SequenceSummary, SequenceWithSteps } from "../domain/sequence.entity";
import { SequenceNotFoundError } from "../domain/sequence.errors";

const mkSummary = (over: Partial<SequenceSummary> = {}): SequenceSummary => ({
  id: "seq-1",
  businessId: "biz-1",
  name: "Follow-Up",
  isActive: false,
  stepCount: 2,
  activeRuns: 0,
  inUse: false,
  inUseReason: null,
  relationshipTier: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...over,
});

const mkWithSteps = (over: Partial<SequenceWithSteps> = {}): SequenceWithSteps => ({
  ...mkSummary(),
  steps: [],
  ...over,
});

const createMockRepo = (overrides: Partial<SequenceRepository> = {}): SequenceRepository => ({
  findAllByBusiness: jest.fn().mockResolvedValue([]),
  findById: jest.fn().mockResolvedValue(mkWithSteps()),
  create: jest.fn(),
  createWithSteps: jest.fn(),
  update: jest.fn().mockResolvedValue(mkSummary({ isActive: true })),
  delete: jest.fn(),
  isReferencedByTierOrCustomer: jest.fn(),
  hasRuns: jest.fn().mockResolvedValue(false),
  countByBusiness: jest.fn().mockResolvedValue(0),
  countActiveRuns: jest.fn().mockResolvedValue(0),
  replaceSteps: jest.fn(),
  addStep: jest.fn(),
  updateStep: jest.fn(),
  deleteStep: jest.fn(),
  reorderSteps: jest.fn(),
  findSenderName: jest.fn().mockResolvedValue(null),
  pauseActiveRuns: jest.fn().mockResolvedValue(0),
  resumeSequencePausedRuns: jest.fn().mockResolvedValue(2),
  stopRunsForCustomerOnSequence: jest.fn().mockResolvedValue(0),
  clearCustomerOverrideIfPointsHere: jest.fn().mockResolvedValue(false),
  ...overrides,
});

describe("ActivateSequenceUseCase", () => {
  it("calls update with isActive:true and then resumeSequencePausedRuns", async () => {
    const repo = createMockRepo();
    const uc = new ActivateSequenceUseCase(repo);

    await uc.execute("seq-1", "biz-1");

    expect(repo.update).toHaveBeenCalledWith("seq-1", "biz-1", { isActive: true });
    expect(repo.resumeSequencePausedRuns).toHaveBeenCalledWith("seq-1", "biz-1");
  });

  it("returns the updated summary from repo.update", async () => {
    const activated = mkSummary({ isActive: true });
    const repo = createMockRepo({ update: jest.fn().mockResolvedValue(activated) });
    const uc = new ActivateSequenceUseCase(repo);

    const result = await uc.execute("seq-1", "biz-1");

    expect(result).toEqual(activated);
    expect(result.isActive).toBe(true);
  });

  it("throws SequenceNotFoundError when sequence does not exist", async () => {
    const repo = createMockRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new ActivateSequenceUseCase(repo);

    await expect(uc.execute("seq-x", "biz-1")).rejects.toThrow(SequenceNotFoundError);
  });

  it("does not call update or resumeSequencePausedRuns when sequence is not found", async () => {
    const repo = createMockRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new ActivateSequenceUseCase(repo);

    await expect(uc.execute("seq-x", "biz-1")).rejects.toThrow(SequenceNotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.resumeSequencePausedRuns).not.toHaveBeenCalled();
  });
});
