import { Inject, Injectable } from "@nestjs/common";
import {
  RELATIONSHIP_TIER_REPOSITORY,
  type CreateTierData,
  type RelationshipTierRepository,
} from "../domain/relationship-tier.repository";
import {
  TierLimitReachedError,
  TierNameAlreadyExistsError,
} from "../domain/relationship-tier.errors";
import type { RelationshipTier } from "../domain/relationship-tier.entity";

const MAX_TIERS_PER_BUSINESS = 10;

@Injectable()
export class CreateTierUseCase {
  constructor(
    @Inject(RELATIONSHIP_TIER_REPOSITORY)
    private readonly repo: RelationshipTierRepository,
  ) {}

  async execute(
    businessId: string,
    data: CreateTierData,
  ): Promise<RelationshipTier> {
    const count = await this.repo.countByBusiness(businessId);
    if (count >= MAX_TIERS_PER_BUSINESS) {
      throw new TierLimitReachedError(businessId, MAX_TIERS_PER_BUSINESS);
    }

    const nameTaken = await this.repo.nameExistsInBusiness(
      data.name,
      businessId,
      undefined,
    );
    if (nameTaken) throw new TierNameAlreadyExistsError(data.name, businessId);

    return this.repo.create(businessId, data);
  }
}
