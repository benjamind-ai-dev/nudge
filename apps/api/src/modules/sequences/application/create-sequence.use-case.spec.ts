import { CreateSequenceUseCase } from "./create-sequence.use-case";
import type { SequenceRepository } from "../domain/sequence.repository";
import type { RelationshipTierRepository } from "../../relationship-tiers/domain/relationship-tier.repository";
import type { SequenceWithSteps, SequenceSummary } from "../domain/sequence.entity";
import {
  SequenceLimitReachedError,
  StepLimitReachedError,
  InvalidStepOrderError,
} from "../domain/sequence.errors";
import { RelationshipTierNotFoundError } from "../../relationship-tiers/domain/relationship-tier.errors";

const mkSummary = (over: Partial<SequenceSummary> = {}): SequenceSummary => ({
  id: "seq-1",
  businessId: "biz-1",
  name: "Follow-Up",
  stepCount: 0,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...over,
});

const mkWithSteps = (over: Partial<SequenceWithSteps> = {}): SequenceWithSteps => ({
  ...mkSummary(),
  steps: [],
  ...over,
});

const mkStep = (stepOrder: number) => ({
  stepOrder,
  delayDays: 1,
  channel: "email" as const,
  subjectTemplate: "Subject",
  bodyTemplate: "Body",
  smsBodyTemplate: null as string | null,
  isOwnerAlert: false,
  includePaymentLink: false,
});

const createMockRepo = (overrides: Partial<SequenceRepository> = {}): SequenceRepository => ({
  findAllByBusiness: jest.fn().mockResolvedValue([]),
  findById: jest.fn(),
  create: jest.fn().mockResolvedValue(mkSummary()),
  update: jest.fn(),
  delete: jest.fn(),
  isReferencedByTierOrCustomer: jest.fn(),
  addStep: jest.fn(),
  updateStep: jest.fn(),
  deleteStep: jest.fn(),
  reorderSteps: jest.fn(),
  countActiveRuns: jest.fn().mockResolvedValue(0),
  countByBusiness: jest.fn().mockResolvedValue(0),
  replaceSteps: jest.fn().mockResolvedValue(mkWithSteps()),
  findSenderName: jest.fn().mockResolvedValue("Sender"),
  createWithSteps: jest.fn().mockResolvedValue(mkWithSteps()),
  ...overrides,
});

const createMockTierRepo = (overrides: Partial<RelationshipTierRepository> = {}): RelationshipTierRepository => ({
  findAllByBusiness: jest.fn().mockResolvedValue([{ id: "tier-1", businessId: "biz-1" }]),
  update: jest.fn(),
  ...overrides,
});

describe("CreateSequenceUseCase", () => {
  it("creates a sequence with no steps when only name is provided", async () => {
    const repo = createMockRepo();
    const tierRepo = createMockTierRepo();
    const useCase = new CreateSequenceUseCase(repo, tierRepo);

    const result = await useCase.execute("biz-1", { name: "Simple" });

    expect(repo.create).toHaveBeenCalledWith({ businessId: "biz-1", name: "Simple" });
    expect(result).toMatchObject({ name: "Follow-Up" });
  });

  it("creates a sequence with steps when steps are provided", async () => {
    const resultWithSteps = mkWithSteps({ steps: [{ id: "s1", stepOrder: 1, delayDays: 1, channel: "email", subjectTemplate: null, bodyTemplate: "Body", smsBodyTemplate: null, isOwnerAlert: false, includePaymentLink: false, createdAt: new Date(), updatedAt: new Date() }] });
    const repo = createMockRepo({ createWithSteps: jest.fn().mockResolvedValue(resultWithSteps) });
    const tierRepo = createMockTierRepo();
    const useCase = new CreateSequenceUseCase(repo, tierRepo);

    const result = await useCase.execute("biz-1", {
      name: "With Steps",
      steps: [mkStep(1)],
    });

    expect(repo.createWithSteps).toHaveBeenCalled();
    expect(result).toMatchObject({ steps: expect.arrayContaining([expect.objectContaining({ stepOrder: 1 })]) });
  });

  it("rejects with SequenceLimitReachedError when business already has 5 sequences", async () => {
    const repo = createMockRepo({ countByBusiness: jest.fn().mockResolvedValue(5) });
    const tierRepo = createMockTierRepo();
    const useCase = new CreateSequenceUseCase(repo, tierRepo);

    await expect(useCase.execute("biz-1", { name: "Sixth", steps: [mkStep(1)] })).rejects.toThrow(SequenceLimitReachedError);
  });

  it("rejects with StepLimitReachedError when more than 10 steps are provided", async () => {
    const repo = createMockRepo();
    const tierRepo = createMockTierRepo();
    const useCase = new CreateSequenceUseCase(repo, tierRepo);

    const steps = Array.from({ length: 11 }, (_, i) => mkStep(i + 1));
    await expect(useCase.execute("biz-1", { name: "Test", steps })).rejects.toThrow(StepLimitReachedError);
  });

  it("rejects with InvalidStepOrderError when step order is not sequential starting at 1", async () => {
    const repo = createMockRepo();
    const tierRepo = createMockTierRepo();
    const useCase = new CreateSequenceUseCase(repo, tierRepo);

    await expect(
      useCase.execute("biz-1", { name: "Test", steps: [mkStep(2)] }),
    ).rejects.toThrow(InvalidStepOrderError);
  });

  it("rejects with RelationshipTierNotFoundError when tier does not belong to business", async () => {
    const repo = createMockRepo();
    const tierRepo = createMockTierRepo({
      findAllByBusiness: jest.fn().mockResolvedValue([{ id: "tier-2", businessId: "biz-1" }]),
    });
    const useCase = new CreateSequenceUseCase(repo, tierRepo);

    await expect(
      useCase.execute("biz-1", {
        name: "Test",
        relationshipTierId: "tier-999",
        steps: [mkStep(1)],
      }),
    ).rejects.toThrow(RelationshipTierNotFoundError);
  });
});
