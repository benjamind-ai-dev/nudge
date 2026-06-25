import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository } from "../domain/sequence.repository";
import { SequenceInUseError, SequenceHasRunsError } from "../domain/sequence.errors";

@Injectable()
export class DeleteSequenceUseCase {
  constructor(@Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository) {}

  async execute(id: string, businessId: string): Promise<void> {
    const inUse = await this.repo.isReferencedByTierOrCustomer(id, businessId);
    if (inUse) throw new SequenceInUseError(id);
    // SequenceRun.sequence is onDelete: Restrict — deleting a sequence with any
    // run (active or historical) raises a DB FK error (Postgres 23001) that
    // surfaces as an unhandled 500. Guard it with a clear 409 instead.
    const hasRuns = await this.repo.hasRuns(id, businessId);
    if (hasRuns) throw new SequenceHasRunsError(id);
    await this.repo.delete(id, businessId);
  }
}
