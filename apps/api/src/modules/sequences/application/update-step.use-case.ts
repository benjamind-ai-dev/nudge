import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository, type UpdateStepData } from "../domain/sequence.repository";
import { channelUsesSms, type SequenceStep } from "../domain/sequence.entity";
import { SmsNotAvailableOnPlanError, TemplateNotInBusinessError } from "../domain/sequence.errors";
import { EntitlementsService } from "../../../common/entitlements/entitlements.service";
import { TEMPLATE_REPOSITORY, type TemplateRepository } from "../../templates/domain/template.repository";

@Injectable()
export class UpdateStepUseCase {
  constructor(
    @Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository,
    private readonly entitlements: EntitlementsService,
    @Inject(TEMPLATE_REPOSITORY) private readonly templateRepo: TemplateRepository,
  ) {}

  async execute(stepId: string, sequenceId: string, businessId: string, data: UpdateStepData): Promise<SequenceStep> {
    if (data.channel !== undefined && channelUsesSms(data.channel)) {
      const limits = await this.entitlements.limitsForBusiness(businessId);
      if (!limits.sms) throw new SmsNotAvailableOnPlanError();
    }

    if (data.templateId) {
      const tmpl = await this.templateRepo.findById(data.templateId, businessId);
      if (!tmpl) throw new TemplateNotInBusinessError(data.templateId);
    }

    return this.repo.updateStep(stepId, sequenceId, businessId, data);
  }
}
