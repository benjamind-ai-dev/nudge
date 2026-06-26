import { DeleteStepUseCase } from "./delete-step.use-case";
import type { SequenceRepository } from "../domain/sequence.repository";
import { SequenceHasActiveRunsError } from "../domain/sequence.errors";

const createMockRepo = (overrides: Partial<SequenceRepository> = {}): SequenceRepository => ({
  findAllByBusiness: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  createWithSteps: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  isReferencedByTierOrCustomer: jest.fn().mockResolvedValue(false),
  hasRuns: jest.fn().mockResolvedValue(false),
  countByBusiness: jest.fn().mockResolvedValue(0),
  countActiveRuns: jest.fn().mockResolvedValue(0),
  replaceSteps: jest.fn(),
  addStep: jest.fn(),
  updateStep: jest.fn(),
  deleteStep: jest.fn().mockResolvedValue(undefined),
  reorderSteps: jest.fn(),
  findSenderName: jest.fn().mockResolvedValue(null),
  pauseActiveRuns: jest.fn().mockResolvedValue(0),
  resumeSequencePausedRuns: jest.fn().mockResolvedValue(0),
  stopRunsForCustomerOnSequence: jest.fn().mockResolvedValue(0),
  clearCustomerOverrideIfPointsHere: jest.fn().mockResolvedValue(false),
  ...overrides,
});

describe("DeleteStepUseCase", () => {
  it("throws SequenceHasActiveRunsError when the sequence has active runs", async () => {
    const repo = createMockRepo({
      countActiveRuns: jest.fn().mockResolvedValue(2),
    });
    const useCase = new DeleteStepUseCase(repo);

    await expect(useCase.execute("step-1", "seq-1", "biz-1")).rejects.toThrow(SequenceHasActiveRunsError);
    expect(repo.deleteStep).not.toHaveBeenCalled();
  });

  it("deletes the step when the sequence has no active runs", async () => {
    const repo = createMockRepo({
      countActiveRuns: jest.fn().mockResolvedValue(0),
    });
    const useCase = new DeleteStepUseCase(repo);

    await useCase.execute("step-1", "seq-1", "biz-1");

    expect(repo.countActiveRuns).toHaveBeenCalledWith("seq-1", "biz-1");
    expect(repo.deleteStep).toHaveBeenCalledWith("step-1", "seq-1", "biz-1");
  });
});
