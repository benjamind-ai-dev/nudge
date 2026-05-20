import { Inject, Injectable } from "@nestjs/common";
import {
  RELATIONSHIP_TIER_REPOSITORY,
  type RelationshipTierRepository,
} from "../domain/relationship-tier.repository";
import {
  CannotDeleteDefaultTierError,
  CannotDeleteTierWithActiveSequencesError,
  RelationshipTierNotFoundError,
} from "../domain/relationship-tier.errors";

@Injectable()
export class DeleteTierUseCase {
  constructor(
    @Inject(RELATIONSHIP_TIER_REPOSITORY)
    private readonly repo: RelationshipTierRepository,
  ) {}

  async execute(id: string, businessId: string): Promise<void> {
    const tier = await this.repo.findById(id, businessId);
    if (!tier) throw new RelationshipTierNotFoundError(id);
    if (tier.isDefault) throw new CannotDeleteDefaultTierError(id);

    const hasActive = await this.repo.hasActiveSequenceRuns(id, businessId);
    if (hasActive) throw new CannotDeleteTierWithActiveSequencesError(id);

    await this.repo.delete(id, businessId);
  }
}
