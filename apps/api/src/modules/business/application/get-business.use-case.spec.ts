import { Test } from "@nestjs/testing";
import { GetBusinessUseCase } from "./get-business.use-case";
import { BusinessNotFoundError } from "../domain/business.errors";
import { BUSINESS_REPOSITORY } from "../domain/business.repository";

const mockRepo = { findById: jest.fn() };

const business = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Acme Corp",
  accountingProvider: "quickbooks",
  senderName: "Acme Billing",
  senderEmail: "billing@acme.com",
  emailSignature: null,
  timezone: "America/New_York",
  isActive: true,
  customerCount: 5,
  invoiceCount: 12,
  connections: [{ provider: "quickbooks", status: "active", lastSyncAt: null }],
};

describe("GetBusinessUseCase", () => {
  let useCase: GetBusinessUseCase;

  beforeEach(async () => {
    mockRepo.findById.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        GetBusinessUseCase,
        { provide: BUSINESS_REPOSITORY, useValue: mockRepo },
      ],
    }).compile();
    useCase = module.get(GetBusinessUseCase);
  });

  it("returns the business when found", async () => {
    mockRepo.findById.mockResolvedValue(business);
    const result = await useCase.execute("550e8400-e29b-41d4-a716-446655440000");
    expect(result).toEqual(business);
  });

  it("throws BusinessNotFoundError when not found", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute("550e8400-e29b-41d4-a716-446655440000"))
      .rejects.toThrow(BusinessNotFoundError);
  });
});
