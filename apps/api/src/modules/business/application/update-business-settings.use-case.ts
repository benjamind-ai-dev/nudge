import { Inject, Injectable } from "@nestjs/common";
import {
  BUSINESS_REPOSITORY,
  type BusinessRepository,
  type BusinessSettings,
  type UpdateBusinessSettingsData,
} from "../domain/business.repository";
import { BusinessNotFoundError } from "../domain/business.errors";

export interface UpdateBusinessSettingsInput {
  businessId: string;
  settings: UpdateBusinessSettingsData;
}

@Injectable()
export class UpdateBusinessSettingsUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY)
    private readonly repo: BusinessRepository,
  ) {}

  async execute(input: UpdateBusinessSettingsInput): Promise<BusinessSettings> {
    const existing = await this.repo.findById(input.businessId);
    if (!existing) {
      throw new BusinessNotFoundError(input.businessId);
    }

    return this.repo.updateSettings(input.businessId, input.settings);
  }
}
