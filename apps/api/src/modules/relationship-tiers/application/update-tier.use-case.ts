import { Inject, Injectable } from "@nestjs/common";
import {
  RELATIONSHIP_TIER_REPOSITORY,
  type RelationshipTierRepository,
  type UpdateTierData,
} from "../domain/relationship-tier.repository";
import { TierNameAlreadyExistsError } from "../domain/relationship-tier.errors";
import type { RelationshipTier } from "../domain/relationship-tier.entity";

@Injectable()
export class UpdateTierUseCase {
  constructor(
    @Inject(RELATIONSHIP_TIER_REPOSITORY)
    private readonly repo: RelationshipTierRepository,
  ) {}

  async execute(
    id: string,
    businessId: string,
    data: UpdateTierData,
  ): Promise<RelationshipTier> {
    if (data.name !== undefined) {
      const taken = await this.repo.nameExistsInBusiness(data.name, businessId, id);
      if (taken) throw new TierNameAlreadyExistsError(data.name, businessId);
    }

    return this.repo.update(id, businessId, data);
  }
}
