import { Test } from "@nestjs/testing";
import { CreateBusinessUseCase } from "./create-business.use-case";
import { BUSINESS_REPOSITORY } from "../domain/business.repository";

const mockRepo = { create: jest.fn() };

const input = {
  accountId: "550e8400-e29b-41d4-a716-446655440001",
  name: "Acme Corp",
  accountingProvider: "quickbooks",
  senderName: "Acme Billing",
  senderEmail: "billing@acme.com",
  timezone: "America/New_York",
};

const created = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Acme Corp",
  accountingProvider: "quickbooks",
  senderName: "Acme Billing",
  senderEmail: "billing@acme.com",
  emailSignature: null,
  timezone: "America/New_York",
  isActive: true,
  connections: [],
};

describe("CreateBusinessUseCase", () => {
  let useCase: CreateBusinessUseCase;

  beforeEach(async () => {
    mockRepo.create.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        CreateBusinessUseCase,
        { provide: BUSINESS_REPOSITORY, useValue: mockRepo },
      ],
    }).compile();
    useCase = module.get(CreateBusinessUseCase);
  });

  it("creates and returns the business", async () => {
    mockRepo.create.mockResolvedValue(created);
    const result = await useCase.execute(input);
    expect(result).toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });
});
