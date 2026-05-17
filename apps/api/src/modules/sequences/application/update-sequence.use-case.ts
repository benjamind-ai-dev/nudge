import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository, type UpdateSequenceData } from "../domain/sequence.repository";
import { RELATIONSHIP_TIER_REPOSITORY, type RelationshipTierRepository } from "../../relationship-tiers/domain/relationship-tier.repository";
import type { SequenceSummary } from "../domain/sequence.entity";
import { RelationshipTierNotFoundError } from "../../relationship-tiers/domain/relationship-tier.errors";

export interface UpdateSequenceInput {
  name?: string;
  isActive?: boolean;
  relationshipTierId?: string | null;
}

@Injectable()
export class UpdateSequenceUseCase {
  constructor(
    @Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository,
    @Inject(RELATIONSHIP_TIER_REPOSITORY) private readonly tierRepo: RelationshipTierRepository,
  ) {}

  async execute(id: string, businessId: string, input: UpdateSequenceInput): Promise<SequenceSummary> {
    if (input.relationshipTierId !== undefined && input.relationshipTierId !== null) {
      await this.assertTierBelongsToBusiness(input.relationshipTierId, businessId);
    }

    const data: UpdateSequenceData = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.relationshipTierId !== undefined) data.relationshipTierId = input.relationshipTierId;

    return this.repo.update(id, businessId, data);
  }

  private async assertTierBelongsToBusiness(tierId: string, businessId: string): Promise<void> {
    const tiers = await this.tierRepo.findAllByBusiness(businessId);
    const found = tiers.some((t) => t.id === tierId);
    if (!found) {
      throw new RelationshipTierNotFoundError(tierId);
    }
  }
}
