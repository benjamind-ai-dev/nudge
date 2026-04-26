import { Test } from "@nestjs/testing";
import { UpdateBusinessSettingsUseCase } from "./update-business-settings.use-case";
import { BusinessNotFoundError } from "../domain/business.errors";
import { BUSINESS_REPOSITORY } from "../domain/business.repository";

const mockRepo = {
  findById: jest.fn(),
  updateSettings: jest.fn(),
};

const existing = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Acme Corp",
  accountingProvider: "quickbooks",
  senderName: "Acme Billing",
  senderEmail: "billing@acme.com",
  emailSignature: null,
  timezone: "America/New_York",
  isActive: true,
  customerCount: 3,
  invoiceCount: 8,
  connections: [],
};

const updated = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Acme Corp",
  senderName: "New Name",
  senderEmail: "billing@acme.com",
  emailSignature: null,
  timezone: "America/New_York",
};

describe("UpdateBusinessSettingsUseCase", () => {
  let useCase: UpdateBusinessSettingsUseCase;

  beforeEach(async () => {
    mockRepo.findById.mockReset();
    mockRepo.updateSettings.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        UpdateBusinessSettingsUseCase,
        { provide: BUSINESS_REPOSITORY, useValue: mockRepo },
      ],
    }).compile();
    useCase = module.get(UpdateBusinessSettingsUseCase);
  });

  it("updates and returns settings when business is found", async () => {
    mockRepo.findById.mockResolvedValue(existing);
    mockRepo.updateSettings.mockResolvedValue(updated);

    const result = await useCase.execute({
      businessId: "550e8400-e29b-41d4-a716-446655440000",
      settings: { senderName: "New Name" },
    });

    expect(result).toEqual(updated);
    expect(mockRepo.updateSettings).toHaveBeenCalledWith(
      "550e8400-e29b-41d4-a716-446655440000",
      { senderName: "New Name" },
    );
  });

  it("throws BusinessNotFoundError when business not found", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        businessId: "550e8400-e29b-41d4-a716-446655440000",
        settings: { senderName: "New Name" },
      }),
    ).rejects.toThrow(BusinessNotFoundError);
  });
});
