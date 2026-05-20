import { Inject, Injectable } from "@nestjs/common";
import {
  SEQUENCE_RUN_REPOSITORY,
  type SequenceRunRepository,
} from "../domain/sequence-run.repository";
import type { SequenceRunDetail } from "../domain/sequence-run.entity";
import { SequenceRunNotFoundError } from "../domain/sequence-run.errors";

@Injectable()
export class GetSequenceRunUseCase {
  constructor(
    @Inject(SEQUENCE_RUN_REPOSITORY)
    private readonly repo: SequenceRunRepository,
  ) {}

  async execute(id: string, businessId: string): Promise<SequenceRunDetail> {
    const detail = await this.repo.findDetailById(id, businessId);
    if (!detail) throw new SequenceRunNotFoundError(id);
    return detail;
  }
}
