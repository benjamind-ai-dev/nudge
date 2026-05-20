import { ListTiersUseCase } from "./list-tiers.use-case";
import type { RelationshipTierRepository } from "../domain/relationship-tier.repository";
import type { RelationshipTier } from "../domain/relationship-tier.entity";

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
  findAllByBusiness: jest.fn().mockResolvedValue([]),
  findById: jest.fn(),
  nameExistsInBusiness: jest.fn(),
  countByBusiness: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  hasActiveSequenceRuns: jest.fn(),
  delete: jest.fn(),
  ...overrides,
});

describe("ListTiersUseCase", () => {
  it("returns tiers including customerCount", async () => {
    const tiers = [
      mkTier({ id: "t1", customerCount: 3 }),
      mkTier({ id: "t2", customerCount: 0, sortOrder: 2 }),
    ];
    const repo = createMockRepo({
      findAllByBusiness: jest.fn().mockResolvedValue(tiers),
    });
    const useCase = new ListTiersUseCase(repo);

    const result = await useCase.execute("biz-1");

    expect(result).toEqual(tiers);
    expect(repo.findAllByBusiness).toHaveBeenCalledWith("biz-1");
  });
});
