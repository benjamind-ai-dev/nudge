import { Inject, Injectable } from "@nestjs/common";
import {
  NEEDS_ATTENTION_REPOSITORY,
  type NeedsAttentionRepository,
} from "../domain/needs-attention.repository";
import type { NeedsAttentionItem } from "../domain/needs-attention-item.entity";

@Injectable()
export class GetNeedsAttentionUseCase {
  constructor(
    @Inject(NEEDS_ATTENTION_REPOSITORY)
    private readonly repo: NeedsAttentionRepository,
  ) {}

  execute(businessId: string, limit: number): Promise<NeedsAttentionItem[]> {
    return this.repo.listItems(businessId, limit);
  }
}
