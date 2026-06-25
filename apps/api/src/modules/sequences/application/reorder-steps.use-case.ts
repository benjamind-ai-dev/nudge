import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository } from "../domain/sequence.repository";
import { SequenceHasActiveRunsError } from "../domain/sequence.errors";

@Injectable()
export class ReorderStepsUseCase {
  constructor(@Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository) {}

  async execute(sequenceId: string, businessId: string, stepOrders: Array<{ stepId: string; stepOrder: number }>): Promise<void> {
    const activeRuns = await this.repo.countActiveRuns(sequenceId, businessId);
    if (activeRuns > 0) {
      throw new SequenceHasActiveRunsError(sequenceId);
    }
    return this.repo.reorderSteps(sequenceId, businessId, stepOrders);
  }
}
