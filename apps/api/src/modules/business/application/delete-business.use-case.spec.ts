import { Test } from "@nestjs/testing";
import { DeleteBusinessUseCase } from "./delete-business.use-case";
import { BusinessNotFoundError } from "../domain/business.errors";
import { BUSINESS_REPOSITORY } from "../domain/business.repository";

const mockRepo = {
  findById: jest.fn(),
  softDelete: jest.fn(),
};

describe("DeleteBusinessUseCase", () => {
  let useCase: DeleteBusinessUseCase;

  beforeEach(async () => {
    mockRepo.findById.mockReset();
    mockRepo.softDelete.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        DeleteBusinessUseCase,
        { provide: BUSINESS_REPOSITORY, useValue: mockRepo },
      ],
    }).compile();
    useCase = module.get(DeleteBusinessUseCase);
  });

  it("soft-deletes the business when found", async () => {
    mockRepo.findById.mockResolvedValue({ id: "550e8400-e29b-41d4-a716-446655440000" });
    mockRepo.softDelete.mockResolvedValue(undefined);

    await useCase.execute("550e8400-e29b-41d4-a716-446655440000");

    expect(mockRepo.softDelete).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440000");
  });

  it("throws BusinessNotFoundError when not found", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute("550e8400-e29b-41d4-a716-446655440000"))
      .rejects.toThrow(BusinessNotFoundError);
  });
});
