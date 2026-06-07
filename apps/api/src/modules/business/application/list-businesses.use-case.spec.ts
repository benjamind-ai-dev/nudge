import { ListBusinessesUseCase } from "./list-businesses.use-case";
import type { BusinessRepository, BusinessWithConnections } from "../domain/business.repository";

function makeRepo(businesses: BusinessWithConnections[]): BusinessRepository {
  return {
    findById: jest.fn(),
    findByAccountId: jest.fn(async () => businesses),
    create: jest.fn(),
    countByAccountId: jest.fn(),
    updateSettings: jest.fn(),
    softDelete: jest.fn(),
  };
}

describe("ListBusinessesUseCase", () => {
  it("returns the account's businesses", async () => {
    const list = [{ id: "biz-1" } as BusinessWithConnections];
    const useCase = new ListBusinessesUseCase(makeRepo(list));
    const result = await useCase.execute("acc-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("biz-1");
  });

  it("returns an empty array when the account has no businesses", async () => {
    const useCase = new ListBusinessesUseCase(makeRepo([]));
    const result = await useCase.execute("acc-1");
    expect(result).toEqual([]);
  });
});
