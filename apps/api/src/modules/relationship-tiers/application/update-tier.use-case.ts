import { Inject, Injectable } from "@nestjs/common";
import { RELATIONSHIP_TIER_REPOSITORY, type RelationshipTierRepository, type UpdateTierData } from "../domain/relationship-tier.repository";
import { RelationshipTierNotFoundError } from "../domain/relationship-tier.errors";
import type { RelationshipTier } from "../domain/relationship-tier.entity";

@Injectable()
export class UpdateTierUseCase {
  constructor(
    @Inject(RELATIONSHIP_TIER_REPOSITORY)
    private readonly repo: RelationshipTierRepository,
  ) {}

  async execute(id: string, businessId: string, data: UpdateTierData): Promise<RelationshipTier> {
    try {
      return await this.repo.update(id, businessId, data);
    } catch (error) {
      if (error instanceof RelationshipTierNotFoundError) throw error;
      throw error;
    }
  }
}
