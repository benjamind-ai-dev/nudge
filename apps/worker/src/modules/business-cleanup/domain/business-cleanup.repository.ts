// apps/worker/src/modules/business-cleanup/domain/business-cleanup.repository.ts
export const BUSINESS_CLEANUP_REPOSITORY = Symbol("BUSINESS_CLEANUP_REPOSITORY");

export interface BusinessCleanupRepository {
  /**
   * Soft-deletes (isActive: false) active businesses created before `cutoff`
   * that have NO connection rows (never completed OAuth). Returns the count.
   */
  deactivateStale(cutoff: Date): Promise<number>;
}
