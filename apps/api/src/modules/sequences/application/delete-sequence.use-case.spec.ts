import { DeleteSequenceUseCase } from "./delete-sequence.use-case";
import type { SequenceRepository } from "../domain/sequence.repository";
import { SequenceInUseError } from "../domain/sequence.errors";

const createMockRepo = (overrides: Partial<SequenceRepository> = {}): SequenceRepository => ({
  findAllByBusiness: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn().mockResolvedValue(undefined),
  isReferencedByTierOrCustomer: jest.fn().mockResolvedValue(false),
  addStep: jest.fn(),
  updateStep: jest.fn(),
  deleteStep: jest.fn(),
  reorderSteps: jest.fn(),
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
});
