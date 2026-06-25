import { ReorderStepsUseCase } from "./reorder-steps.use-case";
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
  reorderSteps: jest.fn().mockResolvedValue(undefined),
  findSenderName: jest.fn().mockResolvedValue(null),
  ...overrides,
});

describe("ReorderStepsUseCase", () => {
  it("throws SequenceHasActiveRunsError when the sequence has active runs", async () => {
    const repo = createMockRepo({
      countActiveRuns: jest.fn().mockResolvedValue(1),
    });
    const useCase = new ReorderStepsUseCase(repo);

    await expect(
      useCase.execute("seq-1", "biz-1", [{ stepId: "s1", stepOrder: 1 }]),
    ).rejects.toThrow(SequenceHasActiveRunsError);
    expect(repo.reorderSteps).not.toHaveBeenCalled();
  });

  it("reorders the steps when the sequence has no active runs", async () => {
    const repo = createMockRepo({
      countActiveRuns: jest.fn().mockResolvedValue(0),
    });
    const useCase = new ReorderStepsUseCase(repo);
    const stepOrders = [{ stepId: "s1", stepOrder: 1 }];

    await useCase.execute("seq-1", "biz-1", stepOrders);

    expect(repo.countActiveRuns).toHaveBeenCalledWith("seq-1", "biz-1");
    expect(repo.reorderSteps).toHaveBeenCalledWith("seq-1", "biz-1", stepOrders);
  });
});
