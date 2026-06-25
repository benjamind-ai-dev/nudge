import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository, type CreateStepData } from "../domain/sequence.repository";
import { RELATIONSHIP_TIER_REPOSITORY, type RelationshipTierRepository } from "../../relationship-tiers/domain/relationship-tier.repository";
import { TEMPLATE_REPOSITORY, type TemplateRepository } from "../../templates/domain/template.repository";
import { MAX_STEPS_PER_SEQUENCE, channelUsesSms, type SequenceWithSteps } from "../domain/sequence.entity";
import {
  SequenceNotFoundError,
  SequenceHasActiveRunsError,
  StepLimitReachedError,
  InvalidStepOrderError,
  SmsNotAvailableOnPlanError,
  TemplateNotInBusinessError,
} from "../domain/sequence.errors";
import { RelationshipTierNotFoundError } from "../../relationship-tiers/domain/relationship-tier.errors";
import { EntitlementsService } from "../../../common/entitlements/entitlements.service";

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
    private readonly entitlements: EntitlementsService,
    @Inject(TEMPLATE_REPOSITORY) private readonly templateRepo: TemplateRepository,
  ) {}

  async execute(id: string, businessId: string, input: ReplaceSequenceInput): Promise<SequenceWithSteps> {
    if (input.steps.length > MAX_STEPS_PER_SEQUENCE) {
      throw new StepLimitReachedError();
    }

    this.validateStepOrder(input.steps);

    if (input.steps.some((s) => channelUsesSms(s.channel))) {
      const limits = await this.entitlements.limitsForBusiness(businessId);
      if (!limits.sms) throw new SmsNotAvailableOnPlanError();
    }

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

    const templateIds = [...new Set(input.steps.map((s) => s.templateId).filter((id): id is string => !!id))];
    for (const templateId of templateIds) {
      const tmpl = await this.templateRepo.findById(templateId, businessId);
      if (!tmpl) throw new TemplateNotInBusinessError(templateId);
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
