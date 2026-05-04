import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository, type CreateStepData } from "../domain/sequence.repository";
import type { SequenceStep } from "../domain/sequence.entity";

@Injectable()
export class AddStepUseCase {
  constructor(@Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository) {}

  async execute(sequenceId: string, businessId: string, data: CreateStepData): Promise<SequenceStep> {
    return this.repo.addStep(sequenceId, businessId, data);
  }
}
