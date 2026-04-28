import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from "../domain/repositories";

@Injectable()
export class ReconcileTotalOutstandingUseCase {
  private readonly logger = new Logger(ReconcileTotalOutstandingUseCase.name);

  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customers: CustomerRepository,
  ) {}

  /**
   * Drift-safety net: recompute `customers.total_outstanding` for every
   * customer in the system. Called from the periodic days-recalc tick.
   *
   * This is the safety pair to the per-invoice atomic updates that
   * `InvoiceRepository.applyChange` performs on the hot path: the hot path
   * keeps the running total accurate per change; this tick guarantees
   * eventual consistency even if a hot-path adjustment was ever skipped
   * (e.g., an invoice ingested via a non-applyChange code path, or
   * historical data that pre-dates the atomic flow).
   */
  async execute(): Promise<{ updatedCount: number }> {
    const start = Date.now();
    const result = await this.customers.reconcileAllTotalOutstanding();
    this.logger.log({
      msg: "Reconciled total_outstanding across all customers",
      event: "reconcile_total_outstanding_completed",
      updatedCount: result.updatedCount,
      durationMs: Date.now() - start,
    });
    return result;
  }
}
