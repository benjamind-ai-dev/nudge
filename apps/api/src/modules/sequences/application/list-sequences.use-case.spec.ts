import { ListSequencesUseCase } from "./list-sequences.use-case";
import type { SequenceRepository } from "../domain/sequence.repository";
import type { SequenceSummary } from "../domain/sequence.entity";

const mkSummary = (over: Partial<SequenceSummary> = {}): SequenceSummary => ({
  id: "seq-1",
  businessId: "biz-1",
  name: "Standard Follow-Up",
  isActive: true,
  stepCount: 6,
  activeRuns: 0,
  inUse: false,
  inUseReason: null,
  relationshipTier: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...over,
});

const createMockRepo = (overrides: Partial<SequenceRepository> = {}): SequenceRepository => ({
  findAllByBusiness: jest.fn().mockResolvedValue([]),
  findById: jest.fn(),
  create: jest.fn(),
  createWithSteps: jest.fn(),
  update: jest.fn(),
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
  ...overrides,
});

describe("ListSequencesUseCase", () => {
  it("returns sequences for the business", async () => {
    const sequences = [mkSummary(), mkSummary({ id: "seq-2", name: "VIP Follow-Up" })];
    const repo = createMockRepo({ findAllByBusiness: jest.fn().mockResolvedValue(sequences) });
    const useCase = new ListSequencesUseCase(repo);

    const result = await useCase.execute("biz-1");

    expect(result).toHaveLength(2);
    expect(repo.findAllByBusiness).toHaveBeenCalledWith("biz-1");
  });

  it("returns empty array when business has no sequences", async () => {
    const repo = createMockRepo();
    const useCase = new ListSequencesUseCase(repo);

    const result = await useCase.execute("biz-1");

    expect(result).toEqual([]);
  });
});
