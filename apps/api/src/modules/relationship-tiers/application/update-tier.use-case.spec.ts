import { UpdateTierUseCase } from "./update-tier.use-case";
import type { RelationshipTierRepository } from "../domain/relationship-tier.repository";
import type { RelationshipTier } from "../domain/relationship-tier.entity";
import { RelationshipTierNotFoundError } from "../domain/relationship-tier.errors";

const mkTier = (over: Partial<RelationshipTier> = {}): RelationshipTier => ({
  id: "tier-1",
  businessId: "biz-1",
  sequenceId: null,
  sequenceName: null,
  name: "Standard",
  description: null,
  isDefault: false,
  sortOrder: 1,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...over,
});

const createMockRepo = (overrides: Partial<RelationshipTierRepository> = {}): RelationshipTierRepository => ({
  findAllByBusiness: jest.fn().mockResolvedValue([]),
  update: jest.fn(),
  ...overrides,
});

describe("UpdateTierUseCase", () => {
  it("assigns a sequenceId to a tier", async () => {
    const updated = mkTier({ sequenceId: "seq-1", sequenceName: "Standard Follow-Up" });
    const repo = createMockRepo({ update: jest.fn().mockResolvedValue(updated) });
    const useCase = new UpdateTierUseCase(repo);

    const result = await useCase.execute("tier-1", "biz-1", { sequenceId: "seq-1" });

    expect(result.sequenceId).toBe("seq-1");
    expect(result.sequenceName).toBe("Standard Follow-Up");
    expect(repo.update).toHaveBeenCalledWith("tier-1", "biz-1", { sequenceId: "seq-1" });
  });

  it("clears sequenceId when null is passed", async () => {
    const updated = mkTier({ sequenceId: null, sequenceName: null });
    const repo = createMockRepo({ update: jest.fn().mockResolvedValue(updated) });
    const useCase = new UpdateTierUseCase(repo);

    const result = await useCase.execute("tier-1", "biz-1", { sequenceId: null });

    expect(result.sequenceId).toBeNull();
    expect(result.sequenceName).toBeNull();
    expect(repo.update).toHaveBeenCalledWith("tier-1", "biz-1", { sequenceId: null });
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
