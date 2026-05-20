import { DeleteTierUseCase } from "./delete-tier.use-case";
import type { RelationshipTierRepository } from "../domain/relationship-tier.repository";
import type { RelationshipTier } from "../domain/relationship-tier.entity";
import {
  CannotDeleteDefaultTierError,
  CannotDeleteTierWithActiveSequencesError,
  RelationshipTierNotFoundError,
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
  findById: jest.fn().mockResolvedValue(mkTier()),
  nameExistsInBusiness: jest.fn(),
  countByBusiness: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  hasActiveSequenceRuns: jest.fn().mockResolvedValue(false),
  delete: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("DeleteTierUseCase", () => {
  it("deletes a non-default tier with no active runs", async () => {
    const repo = createMockRepo();
    const useCase = new DeleteTierUseCase(repo);

    await useCase.execute("tier-1", "biz-1");

    expect(repo.findById).toHaveBeenCalledWith("tier-1", "biz-1");
    expect(repo.hasActiveSequenceRuns).toHaveBeenCalledWith("tier-1", "biz-1");
    expect(repo.delete).toHaveBeenCalledWith("tier-1", "biz-1");
  });

  it("throws RelationshipTierNotFoundError when tier doesn't exist", async () => {
    const repo = createMockRepo({ findById: jest.fn().mockResolvedValue(null) });
    const useCase = new DeleteTierUseCase(repo);

    await expect(useCase.execute("missing", "biz-1")).rejects.toBeInstanceOf(
      RelationshipTierNotFoundError,
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("throws CannotDeleteDefaultTierError for the default tier", async () => {
    const repo = createMockRepo({
      findById: jest.fn().mockResolvedValue(mkTier({ isDefault: true })),
    });
    const useCase = new DeleteTierUseCase(repo);

    await expect(useCase.execute("tier-1", "biz-1")).rejects.toBeInstanceOf(
      CannotDeleteDefaultTierError,
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("throws CannotDeleteTierWithActiveSequencesError when active runs exist", async () => {
    const repo = createMockRepo({
      hasActiveSequenceRuns: jest.fn().mockResolvedValue(true),
    });
    const useCase = new DeleteTierUseCase(repo);

    await expect(useCase.execute("tier-1", "biz-1")).rejects.toBeInstanceOf(
      CannotDeleteTierWithActiveSequencesError,
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
