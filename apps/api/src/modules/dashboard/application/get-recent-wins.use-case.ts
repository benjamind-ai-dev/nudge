import { Inject, Injectable } from "@nestjs/common";
import {
  RECENT_WINS_REPOSITORY,
  type RecentWinsRepository,
} from "../domain/recent-wins.repository";
import type { RecentWinItem } from "../domain/recent-win-item.entity";

@Injectable()
export class GetRecentWinsUseCase {
  constructor(
    @Inject(RECENT_WINS_REPOSITORY)
    private readonly repo: RecentWinsRepository,
  ) {}

  execute(businessId: string, limit: number): Promise<RecentWinItem[]> {
    return this.repo.listItems(businessId, limit);
  }
}
