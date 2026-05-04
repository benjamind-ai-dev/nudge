import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository } from "../domain/sequence.repository";
import type { SequenceWithSteps } from "../domain/sequence.entity";
import { SequenceNotFoundError } from "../domain/sequence.errors";

@Injectable()
export class GetSequenceUseCase {
  constructor(@Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository) {}

  async execute(id: string, businessId: string): Promise<SequenceWithSteps> {
    const seq = await this.repo.findById(id, businessId);
    if (!seq) throw new SequenceNotFoundError(id);
    return seq;
  }
}
