import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository, type CreateStepData } from "../domain/sequence.repository";
import { RELATIONSHIP_TIER_REPOSITORY, type RelationshipTierRepository } from "../../relationship-tiers/domain/relationship-tier.repository";
import { MAX_STEPS_PER_SEQUENCE, type SequenceWithSteps } from "../domain/sequence.entity";
import {
  SequenceNotFoundError,
  SequenceHasActiveRunsError,
  StepLimitReachedError,
  InvalidStepOrderError,
} from "../domain/sequence.errors";
import { RelationshipTierNotFoundError } from "../../relationship-tiers/domain/relationship-tier.errors";

export interface ReplaceSequenceInput {
  name: string;
  relationshipTierId?: string | null;
  steps: CreateStepData[];
}

@Injectable()
export class ReplaceSequenceUseCase {
  constructor(
    @Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository,
    @Inject(RELATIONSHIP_TIER_REPOSITORY) private readonly tierRepo: RelationshipTierRepository,
  ) {}

  async execute(id: string, businessId: string, input: ReplaceSequenceInput): Promise<SequenceWithSteps> {
    if (input.steps.length > MAX_STEPS_PER_SEQUENCE) {
      throw new StepLimitReachedError();
    }

    this.validateStepOrder(input.steps);

    const existing = await this.repo.findById(id, businessId);
    if (!existing) {
      throw new SequenceNotFoundError(id);
    }

    const activeRuns = await this.repo.countActiveRuns(id, businessId);
    if (activeRuns > 0) {
      throw new SequenceHasActiveRunsError(id);
    }

    if (input.relationshipTierId) {
      await this.assertTierBelongsToBusiness(input.relationshipTierId, businessId);
    }

    return this.repo.replaceSteps(id, businessId, {
      name: input.name,
      relationshipTierId: input.relationshipTierId,
      steps: input.steps,
    });
  }

  private validateStepOrder(steps: CreateStepData[]): void {
    const orders = steps.map((s) => s.stepOrder).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        throw new InvalidStepOrderError();
      }
    }
  }

  private async assertTierBelongsToBusiness(tierId: string, businessId: string): Promise<void> {
    const tiers = await this.tierRepo.findAllByBusiness(businessId);
    const found = tiers.some((t) => t.id === tierId);
    if (!found) {
      throw new RelationshipTierNotFoundError(tierId);
    }
  }
}
