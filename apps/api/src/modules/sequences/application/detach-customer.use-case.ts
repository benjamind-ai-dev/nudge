import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository } from "../domain/sequence.repository";

export interface DetachCustomerResult {
  detached: boolean;
  stoppedRuns: number;
}

@Injectable()
export class DetachCustomerUseCase {
  constructor(
    @Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository,
  ) {}

  async execute(sequenceId: string, businessId: string, customerId: string): Promise<DetachCustomerResult> {
    const [detached, stoppedRuns] = await Promise.all([
      this.repo.clearCustomerOverrideIfPointsHere(sequenceId, businessId, customerId),
      this.repo.stopRunsForCustomerOnSequence(sequenceId, businessId, customerId),
    ]);
    return { detached, stoppedRuns };
  }
}
