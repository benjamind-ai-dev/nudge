import { UpdateTierUseCase } from "./update-tier.use-case";
import type { RelationshipTierRepository } from "../domain/relationship-tier.repository";
import type { RelationshipTier } from "../domain/relationship-tier.entity";
import {
  RelationshipTierNotFoundError,
  TierNameAlreadyExistsError,
} from "../domain/relationship-tier.errors";

const mkTier = (over: Partial<RelationshipTier> = {}): RelationshipTier => ({
  id: "tier-1",
  businessId: "biz-1",
  sequenceId: null,
  sequenceName: null,
  name: "Standard",
  description: null,
  isDefault: false,
  sortOrder: 1,
  customerCount: 0,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...over,
});

const createMockRepo = (
  overrides: Partial<RelationshipTierRepository> = {},
): RelationshipTierRepository => ({
  findAllByBusiness: jest.fn(),
  findById: jest.fn(),
  nameExistsInBusiness: jest.fn().mockResolvedValue(false),
  countByBusiness: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  hasActiveSequenceRuns: jest.fn(),
  delete: jest.fn(),
  ...overrides,
});

describe("UpdateTierUseCase", () => {
  it("assigns a sequenceId to a tier", async () => {
    const updated = mkTier({ sequenceId: "seq-1", sequenceName: "Standard Follow-Up" });
    const repo = createMockRepo({ update: jest.fn().mockResolvedValue(updated) });
    const useCase = new UpdateTierUseCase(repo);

    const result = await useCase.execute("tier-1", "biz-1", { sequenceId: "seq-1" });

    expect(result.sequenceId).toBe("seq-1");
    expect(repo.update).toHaveBeenCalledWith("tier-1", "biz-1", { sequenceId: "seq-1" });
    expect(repo.nameExistsInBusiness).not.toHaveBeenCalled();
  });

  it("clears sequenceId when null is passed", async () => {
    const updated = mkTier({ sequenceId: null, sequenceName: null });
    const repo = createMockRepo({ update: jest.fn().mockResolvedValue(updated) });
    const useCase = new UpdateTierUseCase(repo);

    const result = await useCase.execute("tier-1", "biz-1", { sequenceId: null });

    expect(result.sequenceId).toBeNull();
  });

  it("promotes tier to default", async () => {
    const updated = mkTier({ isDefault: true });
    const repo = createMockRepo({ update: jest.fn().mockResolvedValue(updated) });
    const useCase = new UpdateTierUseCase(repo);

    const result = await useCase.execute("tier-1", "biz-1", { isDefault: true });

    expect(result.isDefault).toBe(true);
    expect(repo.update).toHaveBeenCalledWith("tier-1", "biz-1", { isDefault: true });
  });

  it("updates sortOrder", async () => {
    const updated = mkTier({ sortOrder: 5 });
    const repo = createMockRepo({ update: jest.fn().mockResolvedValue(updated) });
    const useCase = new UpdateTierUseCase(repo);

    const result = await useCase.execute("tier-1", "biz-1", { sortOrder: 5 });

    expect(result.sortOrder).toBe(5);
    expect(repo.update).toHaveBeenCalledWith("tier-1", "biz-1", { sortOrder: 5 });
  });

  it("checks name uniqueness when renaming and forwards the call", async () => {
    const updated = mkTier({ name: "VIP" });
    const repo = createMockRepo({ update: jest.fn().mockResolvedValue(updated) });
    const useCase = new UpdateTierUseCase(repo);

    await useCase.execute("tier-1", "biz-1", { name: "VIP" });

    expect(repo.nameExistsInBusiness).toHaveBeenCalledWith("VIP", "biz-1", "tier-1");
    expect(repo.update).toHaveBeenCalledWith("tier-1", "biz-1", { name: "VIP" });
  });

  it("throws TierNameAlreadyExistsError when renaming to a taken name", async () => {
    const repo = createMockRepo({
      nameExistsInBusiness: jest.fn().mockResolvedValue(true),
    });
    const useCase = new UpdateTierUseCase(repo);

    await expect(
      useCase.execute("tier-1", "biz-1", { name: "Taken" }),
    ).rejects.toBeInstanceOf(TierNameAlreadyExistsError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("throws RelationshipTierNotFoundError for unknown tier", async () => {
    const repo = createMockRepo({
      update: jest.fn().mockRejectedValue(new RelationshipTierNotFoundError("unknown-tier")),
    });
    const useCase = new UpdateTierUseCase(repo);

    await expect(useCase.execute("unknown-tier", "biz-1", { name: "VIP" })).rejects.toThrow(
      RelationshipTierNotFoundError,
    );
  });
});
