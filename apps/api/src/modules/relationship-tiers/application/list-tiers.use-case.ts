import { Inject, Injectable } from "@nestjs/common";
import { RELATIONSHIP_TIER_REPOSITORY, type RelationshipTierRepository } from "../domain/relationship-tier.repository";
import type { RelationshipTier } from "../domain/relationship-tier.entity";

@Injectable()
export class ListTiersUseCase {
  constructor(
    @Inject(RELATIONSHIP_TIER_REPOSITORY)
    private readonly repo: RelationshipTierRepository,
  ) {}

  async execute(businessId: string): Promise<RelationshipTier[]> {
    return this.repo.findAllByBusiness(businessId);
  }
}
