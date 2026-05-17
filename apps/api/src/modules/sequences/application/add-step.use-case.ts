import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository, type CreateStepData } from "../domain/sequence.repository";
import { MAX_STEPS_PER_SEQUENCE, type SequenceStep } from "../domain/sequence.entity";
import { SequenceNotFoundError, StepLimitReachedError } from "../domain/sequence.errors";

@Injectable()
export class AddStepUseCase {
  constructor(@Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository) {}

  async execute(sequenceId: string, businessId: string, data: CreateStepData): Promise<SequenceStep> {
    const sequence = await this.repo.findById(sequenceId, businessId);
    if (!sequence) {
      throw new SequenceNotFoundError(sequenceId);
    }

    if (sequence.steps.length >= MAX_STEPS_PER_SEQUENCE) {
      throw new StepLimitReachedError();
    }

    return this.repo.addStep(sequenceId, businessId, data);
  }
}
