import { DeleteSequenceUseCase } from "./delete-sequence.use-case";
import type { SequenceRepository } from "../domain/sequence.repository";
import { SequenceInUseError, SequenceHasRunsError } from "../domain/sequence.errors";

const createMockRepo = (overrides: Partial<SequenceRepository> = {}): SequenceRepository => ({
  findAllByBusiness: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  createWithSteps: jest.fn(),
  update: jest.fn(),
  delete: jest.fn().mockResolvedValue(undefined),
  isReferencedByTierOrCustomer: jest.fn().mockResolvedValue(false),
  hasRuns: jest.fn().mockResolvedValue(false),
  countByBusiness: jest.fn().mockResolvedValue(0),
  countActiveRuns: jest.fn().mockResolvedValue(0),
  replaceSteps: jest.fn(),
  addStep: jest.fn(),
  updateStep: jest.fn(),
  deleteStep: jest.fn(),
  reorderSteps: jest.fn(),
  findSenderName: jest.fn().mockResolvedValue(null),
  pauseActiveRuns: jest.fn().mockResolvedValue(0),
  resumeSequencePausedRuns: jest.fn().mockResolvedValue(0),
  stopRunsForCustomerOnSequence: jest.fn().mockResolvedValue(0),
  clearCustomerOverrideIfPointsHere: jest.fn().mockResolvedValue(false),
  ...overrides,
});

describe("DeleteSequenceUseCase", () => {
  it("deletes sequence when not in use", async () => {
    const repo = createMockRepo();
    const useCase = new DeleteSequenceUseCase(repo);

    await useCase.execute("seq-1", "biz-1");

    expect(repo.isReferencedByTierOrCustomer).toHaveBeenCalledWith("seq-1", "biz-1");
    expect(repo.delete).toHaveBeenCalledWith("seq-1", "biz-1");
  });

  it("throws SequenceInUseError when sequence is assigned to a tier or customer", async () => {
    const repo = createMockRepo({
      isReferencedByTierOrCustomer: jest.fn().mockResolvedValue(true),
    });
    const useCase = new DeleteSequenceUseCase(repo);

    await expect(useCase.execute("seq-1", "biz-1")).rejects.toThrow(SequenceInUseError);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("throws SequenceHasRunsError when the sequence has runs (active or historical)", async () => {
    const repo = createMockRepo({
      hasRuns: jest.fn().mockResolvedValue(true),
    });
    const useCase = new DeleteSequenceUseCase(repo);

    await expect(useCase.execute("seq-1", "biz-1")).rejects.toThrow(SequenceHasRunsError);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
