import { Inject, Injectable } from "@nestjs/common";
import {
  SEQUENCE_RUN_REPOSITORY,
  type SequenceRunListFilter,
  type SequenceRunRepository,
} from "../domain/sequence-run.repository";
import type { SequenceRunListItem } from "../domain/sequence-run.entity";

export interface ListSequenceRunsResult {
  data: SequenceRunListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class ListSequenceRunsUseCase {
  constructor(
    @Inject(SEQUENCE_RUN_REPOSITORY)
    private readonly repo: SequenceRunRepository,
  ) {}

  async execute(filter: SequenceRunListFilter): Promise<ListSequenceRunsResult> {
    const { items, total } = await this.repo.findManyByFilter(filter);
    const totalPages = Math.max(1, Math.ceil(total / filter.limit));
    return {
      data: items,
      pagination: { page: filter.page, limit: filter.limit, total, totalPages },
    };
  }
}
