import type { SequenceRepository } from "../domain/sequence.repository";
import { DetachCustomerUseCase } from "./detach-customer.use-case";

function makeRepo(overrides: Partial<SequenceRepository> = {}): SequenceRepository {
  return {
    findAllByBusiness: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    createWithSteps: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    isReferencedByTierOrCustomer: jest.fn(),
    hasRuns: jest.fn(),
    countByBusiness: jest.fn(),
    countActiveRuns: jest.fn(),
    replaceSteps: jest.fn(),
    addStep: jest.fn(),
    updateStep: jest.fn(),
    deleteStep: jest.fn(),
    reorderSteps: jest.fn(),
    findSenderName: jest.fn(),
    pauseActiveRuns: jest.fn(),
    resumeSequencePausedRuns: jest.fn(),
    stopRunsForCustomerOnSequence: jest.fn().mockResolvedValue(0),
    clearCustomerOverrideIfPointsHere: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

describe("DetachCustomerUseCase", () => {
  it("returns detached:true and stoppedRuns count when override cleared and runs stopped", async () => {
    const repo = makeRepo({
      clearCustomerOverrideIfPointsHere: jest.fn().mockResolvedValue(true),
      stopRunsForCustomerOnSequence: jest.fn().mockResolvedValue(3),
    });

    const result = await new DetachCustomerUseCase(repo).execute("seq-1", "biz-1", "cust-1");

    expect(repo.clearCustomerOverrideIfPointsHere).toHaveBeenCalledWith("seq-1", "biz-1", "cust-1");
    expect(repo.stopRunsForCustomerOnSequence).toHaveBeenCalledWith("seq-1", "biz-1", "cust-1");
    expect(result).toEqual({ detached: true, stoppedRuns: 3 });
  });

  it("returns detached:false and stoppedRuns:0 when override not cleared and no runs stopped", async () => {
    const repo = makeRepo({
      clearCustomerOverrideIfPointsHere: jest.fn().mockResolvedValue(false),
      stopRunsForCustomerOnSequence: jest.fn().mockResolvedValue(0),
    });

    const result = await new DetachCustomerUseCase(repo).execute("seq-1", "biz-1", "cust-x");

    expect(result).toEqual({ detached: false, stoppedRuns: 0 });
  });
});
