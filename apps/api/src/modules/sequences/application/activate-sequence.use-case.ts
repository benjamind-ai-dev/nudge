import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository } from "../domain/sequence.repository";
import type { SequenceSummary } from "../domain/sequence.entity";
import { SequenceNotFoundError } from "../domain/sequence.errors";

@Injectable()
export class ActivateSequenceUseCase {
  constructor(
    @Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository,
  ) {}

  async execute(id: string, businessId: string): Promise<SequenceSummary> {
    const existing = await this.repo.findById(id, businessId);
    if (!existing) throw new SequenceNotFoundError(id);

    const updated = await this.repo.update(id, businessId, { isActive: true });
    await this.repo.resumeSequencePausedRuns(id, businessId);
    return updated;
  }
}
