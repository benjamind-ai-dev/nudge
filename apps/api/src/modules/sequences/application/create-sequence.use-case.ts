import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository, type CreateStepData } from "../domain/sequence.repository";
import { RELATIONSHIP_TIER_REPOSITORY, type RelationshipTierRepository } from "../../relationship-tiers/domain/relationship-tier.repository";
import { EntitlementsService } from "../../../common/entitlements/entitlements.service";
import {
  MAX_STEPS_PER_SEQUENCE,
  type SequenceSummary,
  type SequenceWithSteps,
} from "../domain/sequence.entity";
import {
  SequenceLimitReachedError,
  StepLimitReachedError,
  InvalidStepOrderError,
} from "../domain/sequence.errors";
import { RelationshipTierNotFoundError } from "../../relationship-tiers/domain/relationship-tier.errors";

export interface CreateSequenceInput {
  name: string;
  relationshipTierId?: string | null;
  steps?: CreateStepData[];
}

@Injectable()
export class CreateSequenceUseCase {
  constructor(
    @Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository,
    @Inject(RELATIONSHIP_TIER_REPOSITORY) private readonly tierRepo: RelationshipTierRepository,
    private readonly entitlements: EntitlementsService,
  ) {}

  async execute(businessId: string, input: CreateSequenceInput): Promise<SequenceSummary | SequenceWithSteps> {
    const limits = await this.entitlements.limitsForBusiness(businessId);
    const count = await this.repo.countByBusiness(businessId);
    if (count >= limits.maxSequencesPerBusiness) {
      throw new SequenceLimitReachedError(limits.maxSequencesPerBusiness);
    }

    const steps = input.steps ?? [];

    if (steps.length > MAX_STEPS_PER_SEQUENCE) {
      throw new StepLimitReachedError();
    }

    if (steps.length > 0) {
      this.validateStepOrder(steps);
    }

    if (input.relationshipTierId) {
      await this.assertTierBelongsToBusiness(input.relationshipTierId, businessId);
    }

    if (steps.length > 0) {
      return this.repo.createWithSteps({
        businessId,
        name: input.name,
        relationshipTierId: input.relationshipTierId,
        steps,
      });
    }

    return this.repo.create({
      businessId,
      name: input.name,
      relationshipTierId: input.relationshipTierId,
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
