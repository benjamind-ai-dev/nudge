import { CreateTierUseCase } from "./create-tier.use-case";
import type { RelationshipTierRepository } from "../domain/relationship-tier.repository";
import type { RelationshipTier } from "../domain/relationship-tier.entity";
import {
  TierLimitReachedError,
  TierNameAlreadyExistsError,
} from "../domain/relationship-tier.errors";

const mkTier = (over: Partial<RelationshipTier> = {}): RelationshipTier => ({
  id: "tier-1",
  businessId: "biz-1",
  sequenceId: null,
  sequenceName: null,
  name: "VIP",
  description: null,
  isDefault: false,
  sortOrder: 3,
  customerCount: 0,
  createdAt: new Date("2026-05-20"),
  updatedAt: new Date("2026-05-20"),
  ...over,
});

const createMockRepo = (
  overrides: Partial<RelationshipTierRepository> = {},
): RelationshipTierRepository => ({
  findAllByBusiness: jest.fn(),
  findById: jest.fn(),
  nameExistsInBusiness: jest.fn().mockResolvedValue(false),
  countByBusiness: jest.fn().mockResolvedValue(0),
  create: jest.fn(),
  update: jest.fn(),
  hasActiveSequenceRuns: jest.fn(),
  delete: jest.fn(),
  ...overrides,
});

describe("CreateTierUseCase", () => {
  it("creates a new tier", async () => {
    const created = mkTier();
    const repo = createMockRepo({ create: jest.fn().mockResolvedValue(created) });
    const useCase = new CreateTierUseCase(repo);

    const result = await useCase.execute("biz-1", { name: "VIP" });

    expect(result).toEqual(created);
    expect(repo.countByBusiness).toHaveBeenCalledWith("biz-1");
    expect(repo.nameExistsInBusiness).toHaveBeenCalledWith("VIP", "biz-1", undefined);
    expect(repo.create).toHaveBeenCalledWith("biz-1", { name: "VIP" });
  });

  it("throws TierLimitReachedError when business already has 10 tiers", async () => {
    const repo = createMockRepo({ countByBusiness: jest.fn().mockResolvedValue(10) });
    const useCase = new CreateTierUseCase(repo);

    await expect(useCase.execute("biz-1", { name: "VIP" })).rejects.toBeInstanceOf(
      TierLimitReachedError,
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("throws TierNameAlreadyExistsError when name is taken", async () => {
    const repo = createMockRepo({
      nameExistsInBusiness: jest.fn().mockResolvedValue(true),
    });
    const useCase = new CreateTierUseCase(repo);

    await expect(useCase.execute("biz-1", { name: "VIP" })).rejects.toBeInstanceOf(
      TierNameAlreadyExistsError,
    );
    expect(repo.create).not.toHaveBeenCalled();
  });
});
