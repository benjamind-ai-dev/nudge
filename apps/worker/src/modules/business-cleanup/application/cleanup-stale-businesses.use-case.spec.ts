import { CleanupStaleBusinessesUseCase } from "./cleanup-stale-businesses.use-case";
import type { BusinessCleanupRepository } from "../domain/business-cleanup.repository";

describe("CleanupStaleBusinessesUseCase", () => {
  it("delegates to the repository with the given cutoff and returns the count", async () => {
    const repo: BusinessCleanupRepository = {
      deactivateStale: jest.fn(async () => 3),
    };
    const useCase = new CleanupStaleBusinessesUseCase(repo);
    const cutoff = new Date("2026-06-06T00:00:00Z");

    const count = await useCase.execute(cutoff);

    expect(repo.deactivateStale).toHaveBeenCalledWith(cutoff);
    expect(count).toBe(3);
  });

  it("returns 0 when nothing is stale", async () => {
    const repo: BusinessCleanupRepository = { deactivateStale: jest.fn(async () => 0) };
    const useCase = new CleanupStaleBusinessesUseCase(repo);
    expect(await useCase.execute(new Date())).toBe(0);
  });
});
