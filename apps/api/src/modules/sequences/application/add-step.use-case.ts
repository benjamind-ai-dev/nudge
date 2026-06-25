import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository, type CreateStepData } from "../domain/sequence.repository";
import { MAX_STEPS_PER_SEQUENCE, channelUsesSms, type SequenceStep } from "../domain/sequence.entity";
import {
  SequenceNotFoundError,
  SequenceHasActiveRunsError,
  StepLimitReachedError,
  SmsNotAvailableOnPlanError,
  TemplateNotInBusinessError,
} from "../domain/sequence.errors";
import { EntitlementsService } from "../../../common/entitlements/entitlements.service";
import { TEMPLATE_REPOSITORY, type TemplateRepository } from "../../templates/domain/template.repository";

@Injectable()
export class AddStepUseCase {
  constructor(
    @Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository,
    private readonly entitlements: EntitlementsService,
    @Inject(TEMPLATE_REPOSITORY) private readonly templateRepo: TemplateRepository,
  ) {}

  async execute(sequenceId: string, businessId: string, data: CreateStepData): Promise<SequenceStep> {
    const sequence = await this.repo.findById(sequenceId, businessId);
    if (!sequence) {
      throw new SequenceNotFoundError(sequenceId);
    }

    const activeRuns = await this.repo.countActiveRuns(sequenceId, businessId);
    if (activeRuns > 0) {
      throw new SequenceHasActiveRunsError(sequenceId);
    }

    if (sequence.steps.length >= MAX_STEPS_PER_SEQUENCE) {
      throw new StepLimitReachedError();
    }

    if (channelUsesSms(data.channel)) {
      const limits = await this.entitlements.limitsForBusiness(businessId);
      if (!limits.sms) throw new SmsNotAvailableOnPlanError();
    }

    if (data.templateId) {
      const tmpl = await this.templateRepo.findById(data.templateId, businessId);
      if (!tmpl) throw new TemplateNotInBusinessError(data.templateId);
    }

    return this.repo.addStep(sequenceId, businessId, data);
  }
}
