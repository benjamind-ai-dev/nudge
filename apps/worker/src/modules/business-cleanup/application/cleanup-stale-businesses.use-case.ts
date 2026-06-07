// apps/worker/src/modules/business-cleanup/application/cleanup-stale-businesses.use-case.ts
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  BUSINESS_CLEANUP_REPOSITORY,
  type BusinessCleanupRepository,
} from "../domain/business-cleanup.repository";

@Injectable()
export class CleanupStaleBusinessesUseCase {
  private readonly logger = new Logger(CleanupStaleBusinessesUseCase.name);

  constructor(
    @Inject(BUSINESS_CLEANUP_REPOSITORY)
    private readonly repo: BusinessCleanupRepository,
  ) {}

  async execute(cutoff: Date): Promise<number> {
    const count = await this.repo.deactivateStale(cutoff);
    if (count > 0) {
      this.logger.log({
        msg: "Soft-deleted stale connection-less businesses",
        event: "stale_businesses_cleaned",
        count,
        cutoff: cutoff.toISOString(),
      });
    }
    return count;
  }
}
