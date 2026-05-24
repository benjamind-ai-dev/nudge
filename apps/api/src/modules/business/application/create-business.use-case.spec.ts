import { Test } from "@nestjs/testing";
import { CreateBusinessUseCase } from "./create-business.use-case";
import { BUSINESS_REPOSITORY } from "../domain/business.repository";
import { CreateDefaultTemplateUseCase } from "../../templates/application/create-default-template.use-case";

const mockRepo = { create: jest.fn() };
const mockDefaultTemplate = { execute: jest.fn() };

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
  customerCount: 0,
  invoiceCount: 0,
  connections: [],
};

describe("CreateBusinessUseCase", () => {
  let useCase: CreateBusinessUseCase;

  beforeEach(async () => {
    mockRepo.create.mockReset();
    mockDefaultTemplate.execute.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        CreateBusinessUseCase,
        { provide: BUSINESS_REPOSITORY, useValue: mockRepo },
        { provide: CreateDefaultTemplateUseCase, useValue: mockDefaultTemplate },
      ],
    }).compile();
    useCase = module.get(CreateBusinessUseCase);
  });

  it("creates and returns the business", async () => {
    mockRepo.create.mockResolvedValue(created);
    mockDefaultTemplate.execute.mockResolvedValue({});
    const result = await useCase.execute(input);
    expect(result).toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  it("creates the default template for the new business after insert", async () => {
    mockRepo.create.mockResolvedValue(created);
    mockDefaultTemplate.execute.mockResolvedValue({});
    await useCase.execute(input);
    expect(mockDefaultTemplate.execute).toHaveBeenCalledWith({
      businessId: created.id,
    });
  });

  it("does not throw if default-template seeding fails", async () => {
    mockRepo.create.mockResolvedValue(created);
    mockDefaultTemplate.execute.mockRejectedValue(new Error("DB error"));
    await expect(useCase.execute(input)).resolves.toEqual(created);
  });
});
