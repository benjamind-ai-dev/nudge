import { UpdateSequenceUseCase } from "./update-sequence.use-case";
import type { SequenceRepository } from "../domain/sequence.repository";
import type { RelationshipTierRepository } from "../../relationship-tiers/domain/relationship-tier.repository";
import type { SequenceSummary } from "../domain/sequence.entity";
import { SequenceNotFoundError } from "../domain/sequence.errors";
import { RelationshipTierNotFoundError } from "../../relationship-tiers/domain/relationship-tier.errors";

const mkSummary = (over: Partial<SequenceSummary> = {}): SequenceSummary => ({
  id: "seq-1",
  businessId: "biz-1",
  name: "Follow-Up",
  isActive: true,
  stepCount: 3,
  activeRuns: 0,
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
  update: jest.fn().mockResolvedValue(mkSummary()),
  delete: jest.fn(),
  isReferencedByTierOrCustomer: jest.fn(),
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

const createMockTierRepo = (overrides: Partial<RelationshipTierRepository> = {}): RelationshipTierRepository => ({
  findAllByBusiness: jest.fn().mockResolvedValue([{ id: "tier-1", businessId: "biz-1", name: "VIP", sortOrder: 1, isDefault: false, description: null, createdAt: new Date(), updatedAt: new Date() }]),
  update: jest.fn(),
  ...overrides,
});

describe("UpdateSequenceUseCase", () => {
  it("updates sequence name", async () => {
    const repo = createMockRepo();
    const tierRepo = createMockTierRepo();
    const useCase = new UpdateSequenceUseCase(repo, tierRepo);

    await useCase.execute("seq-1", "biz-1", { name: "New Name" });

    expect(repo.update).toHaveBeenCalledWith("seq-1", "biz-1", expect.objectContaining({ name: "New Name" }));
  });

  it("updates isActive to false", async () => {
    const repo = createMockRepo();
    const tierRepo = createMockTierRepo();
    const useCase = new UpdateSequenceUseCase(repo, tierRepo);

    await useCase.execute("seq-1", "biz-1", { isActive: false });

    expect(repo.update).toHaveBeenCalledWith("seq-1", "biz-1", expect.objectContaining({ isActive: false }));
  });

  it("updates relationshipTierId when tier belongs to business", async () => {
    const repo = createMockRepo();
    const tierRepo = createMockTierRepo();
    const useCase = new UpdateSequenceUseCase(repo, tierRepo);

    await useCase.execute("seq-1", "biz-1", { relationshipTierId: "tier-1" });

    expect(tierRepo.findAllByBusiness).toHaveBeenCalledWith("biz-1");
    expect(repo.update).toHaveBeenCalledWith("seq-1", "biz-1", expect.objectContaining({ relationshipTierId: "tier-1" }));
  });

  it("unsets relationshipTierId when null is passed", async () => {
    const repo = createMockRepo();
    const tierRepo = createMockTierRepo();
    const useCase = new UpdateSequenceUseCase(repo, tierRepo);

    await useCase.execute("seq-1", "biz-1", { relationshipTierId: null });

    expect(tierRepo.findAllByBusiness).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith("seq-1", "biz-1", expect.objectContaining({ relationshipTierId: null }));
  });

  it("does not pass relationshipTierId when undefined (no change)", async () => {
    const repo = createMockRepo();
    const tierRepo = createMockTierRepo();
    const useCase = new UpdateSequenceUseCase(repo, tierRepo);

    await useCase.execute("seq-1", "biz-1", { name: "Only Name" });

    expect(tierRepo.findAllByBusiness).not.toHaveBeenCalled();
    const updateCall = (repo.update as jest.Mock).mock.calls[0][2];
    expect(updateCall).not.toHaveProperty("relationshipTierId");
  });

  it("rejects with RelationshipTierNotFoundError when tier does not belong to business", async () => {
    const repo = createMockRepo();
    const tierRepo = createMockTierRepo({
      findAllByBusiness: jest.fn().mockResolvedValue([{ id: "tier-2", businessId: "biz-1" }]),
    });
    const useCase = new UpdateSequenceUseCase(repo, tierRepo);

    await expect(
      useCase.execute("seq-1", "biz-1", { relationshipTierId: "tier-999" }),
    ).rejects.toThrow(RelationshipTierNotFoundError);
  });

  it("propagates SequenceNotFoundError from repo", async () => {
    const repo = createMockRepo({
      update: jest.fn().mockRejectedValue(new SequenceNotFoundError("seq-1")),
    });
    const tierRepo = createMockTierRepo();
    const useCase = new UpdateSequenceUseCase(repo, tierRepo);

    await expect(useCase.execute("seq-1", "biz-1", { name: "x" })).rejects.toThrow(SequenceNotFoundError);
  });
});
