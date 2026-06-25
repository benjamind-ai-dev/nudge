import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository } from "../domain/sequence.repository";
import { SequenceHasActiveRunsError } from "../domain/sequence.errors";

@Injectable()
export class DeleteStepUseCase {
  constructor(@Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository) {}

  async execute(stepId: string, sequenceId: string, businessId: string): Promise<void> {
    const activeRuns = await this.repo.countActiveRuns(sequenceId, businessId);
    if (activeRuns > 0) {
      throw new SequenceHasActiveRunsError(sequenceId);
    }
    return this.repo.deleteStep(stepId, sequenceId, businessId);
  }
}
