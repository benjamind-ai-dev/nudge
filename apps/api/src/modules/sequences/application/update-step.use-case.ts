import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository, type UpdateStepData } from "../domain/sequence.repository";
import type { SequenceStep } from "../domain/sequence.entity";

@Injectable()
export class UpdateStepUseCase {
  constructor(@Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository) {}

  async execute(stepId: string, sequenceId: string, businessId: string, data: UpdateStepData): Promise<SequenceStep> {
    return this.repo.updateStep(stepId, sequenceId, businessId, data);
  }
}
