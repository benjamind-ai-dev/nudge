import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository } from "../domain/sequence.repository";
import type { SequenceSummary } from "../domain/sequence.entity";

@Injectable()
export class ListSequencesUseCase {
  constructor(@Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository) {}

  async execute(businessId: string): Promise<SequenceSummary[]> {
    return this.repo.findAllByBusiness(businessId);
  }
}
