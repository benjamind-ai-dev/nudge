import { ReplaceSequenceUseCase } from "./replace-sequence.use-case";
import type { SequenceRepository } from "../domain/sequence.repository";
import type { RelationshipTierRepository } from "../../relationship-tiers/domain/relationship-tier.repository";
import type { SequenceWithSteps } from "../domain/sequence.entity";
import {
  SequenceHasActiveRunsError,
  StepLimitReachedError,
  InvalidStepOrderError,
} from "../domain/sequence.errors";
import { RelationshipTierNotFoundError } from "../../relationship-tiers/domain/relationship-tier.errors";

const mkWithSteps = (over: Partial<SequenceWithSteps> = {}): SequenceWithSteps => ({
  id: "seq-1",
  businessId: "biz-1",
  name: "Follow-Up",
  stepCount: 1,
  steps: [],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...over,
});

const mkStep = (stepOrder: number) => ({
  stepOrder,
  delayDays: 1,
  channel: "email" as const,
  subjectTemplate: "Subject",
  bodyTemplate: "Body",
  smsBodyTemplate: null,
  isOwnerAlert: false,
  includePaymentLink: false,
});

const createMockRepo = (overrides: Partial<SequenceRepository> = {}): SequenceRepository => ({
  findAllByBusiness: jest.fn().mockResolvedValue([]),
  findById: jest.fn().mockResolvedValue(mkWithSteps()),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  isReferencedByTierOrCustomer: jest.fn().mockResolvedValue(false),
  addStep: jest.fn(),
  updateStep: jest.fn(),
  deleteStep: jest.fn(),
  reorderSteps: jest.fn(),
  countActiveRuns: jest.fn().mockResolvedValue(0),
  countByBusiness: jest.fn().mockResolvedValue(1),
  createWithSteps: jest.fn(),
  replaceSteps: jest.fn().mockResolvedValue(mkWithSteps()),
  findSenderName: jest.fn().mockResolvedValue(null),
  ...overrides,
});

const createMockTierRepo = (overrides: Partial<RelationshipTierRepository> = {}): RelationshipTierRepository => ({
  findAllByBusiness: jest.fn().mockResolvedValue([{ id: "tier-1", businessId: "biz-1" }]),
  update: jest.fn(),
  ...overrides,
});

describe("ReplaceSequenceUseCase", () => {
  it("replaces sequence name, tier, and steps on happy path", async () => {
    const result = mkWithSteps({ name: "Updated", steps: [{ id: "step-1", stepOrder: 1, delayDays: 1, channel: "email", subjectTemplate: null, bodyTemplate: "Body", smsBodyTemplate: null, isOwnerAlert: false, includePaymentLink: false, createdAt: new Date(), updatedAt: new Date() }] });
    const repo = createMockRepo({ replaceSteps: jest.fn().mockResolvedValue(result) });
    const tierRepo = createMockTierRepo();
    const useCase = new ReplaceSequenceUseCase(repo, tierRepo);

    const outcome = await useCase.execute("seq-1", "biz-1", {
      name: "Updated",
      relationshipTierId: "tier-1",
      steps: [mkStep(1)],
    });

    expect(repo.countActiveRuns).toHaveBeenCalledWith("seq-1", "biz-1");
    expect(repo.replaceSteps).toHaveBeenCalledWith(
      "seq-1",
      "biz-1",
      expect.objectContaining({ name: "Updated", relationshipTierId: "tier-1", steps: [mkStep(1)] }),
    );
    expect(outcome.name).toBe("Updated");
  });

  it("rejects with SequenceHasActiveRunsError when sequence has active runs", async () => {
    const repo = createMockRepo({ countActiveRuns: jest.fn().mockResolvedValue(3) });
    const tierRepo = createMockTierRepo();
    const useCase = new ReplaceSequenceUseCase(repo, tierRepo);

    await expect(
      useCase.execute("seq-1", "biz-1", {
        name: "Updated",
        steps: [mkStep(1)],
      }),
    ).rejects.toThrow(SequenceHasActiveRunsError);
  });

  it("rejects with StepLimitReachedError when more than 10 steps are provided", async () => {
    const repo = createMockRepo();
    const tierRepo = createMockTierRepo();
    const useCase = new ReplaceSequenceUseCase(repo, tierRepo);

    const steps = Array.from({ length: 11 }, (_, i) => mkStep(i + 1));
    await expect(
      useCase.execute("seq-1", "biz-1", { name: "Test", steps }),
    ).rejects.toThrow(StepLimitReachedError);
  });

  it("rejects with InvalidStepOrderError when step order is not sequential starting at 1", async () => {
    const repo = createMockRepo();
    const tierRepo = createMockTierRepo();
    const useCase = new ReplaceSequenceUseCase(repo, tierRepo);

    await expect(
      useCase.execute("seq-1", "biz-1", {
        name: "Test",
        steps: [mkStep(2), mkStep(3)],
      }),
    ).rejects.toThrow(InvalidStepOrderError);
  });

  it("rejects with InvalidStepOrderError when step orders have gaps", async () => {
    const repo = createMockRepo();
    const tierRepo = createMockTierRepo();
    const useCase = new ReplaceSequenceUseCase(repo, tierRepo);

    await expect(
      useCase.execute("seq-1", "biz-1", {
        name: "Test",
        steps: [mkStep(1), mkStep(3)],
      }),
    ).rejects.toThrow(InvalidStepOrderError);
  });

  it("rejects with RelationshipTierNotFoundError when tier does not belong to business", async () => {
    const repo = createMockRepo();
    const tierRepo = createMockTierRepo({
      findAllByBusiness: jest.fn().mockResolvedValue([{ id: "tier-2", businessId: "biz-1" }]),
    });
    const useCase = new ReplaceSequenceUseCase(repo, tierRepo);

    await expect(
      useCase.execute("seq-1", "biz-1", {
        name: "Test",
        relationshipTierId: "tier-999",
        steps: [mkStep(1)],
      }),
    ).rejects.toThrow(RelationshipTierNotFoundError);
  });
});
