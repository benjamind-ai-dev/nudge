import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository } from "../domain/sequence.repository";

@Injectable()
export class DeleteStepUseCase {
  constructor(@Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository) {}

  async execute(stepId: string, sequenceId: string, businessId: string): Promise<void> {
    return this.repo.deleteStep(stepId, sequenceId, businessId);
  }
}
