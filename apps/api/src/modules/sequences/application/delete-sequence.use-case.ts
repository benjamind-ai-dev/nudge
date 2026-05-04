import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository } from "../domain/sequence.repository";
import { SequenceInUseError } from "../domain/sequence.errors";

@Injectable()
export class DeleteSequenceUseCase {
  constructor(@Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository) {}

  async execute(id: string, businessId: string): Promise<void> {
    const inUse = await this.repo.isReferencedByTierOrCustomer(id, businessId);
    if (inUse) throw new SequenceInUseError(id);
    await this.repo.delete(id, businessId);
  }
}
