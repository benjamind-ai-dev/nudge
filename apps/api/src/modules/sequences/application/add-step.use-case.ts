import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository, type CreateStepData } from "../domain/sequence.repository";
import { MAX_STEPS_PER_SEQUENCE, channelUsesSms, type SequenceStep } from "../domain/sequence.entity";
import {
  SequenceNotFoundError,
  StepLimitReachedError,
  SmsNotAvailableOnPlanError,
} from "../domain/sequence.errors";
import { EntitlementsService } from "../../../common/entitlements/entitlements.service";

@Injectable()
export class AddStepUseCase {
  constructor(
    @Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository,
    private readonly entitlements: EntitlementsService,
  ) {}

  async execute(sequenceId: string, businessId: string, data: CreateStepData): Promise<SequenceStep> {
    const sequence = await this.repo.findById(sequenceId, businessId);
    if (!sequence) {
      throw new SequenceNotFoundError(sequenceId);
    }

    if (sequence.steps.length >= MAX_STEPS_PER_SEQUENCE) {
      throw new StepLimitReachedError();
    }

    if (channelUsesSms(data.channel)) {
      const limits = await this.entitlements.limitsForBusiness(businessId);
      if (!limits.sms) throw new SmsNotAvailableOnPlanError();
    }

    return this.repo.addStep(sequenceId, businessId, data);
  }
}
