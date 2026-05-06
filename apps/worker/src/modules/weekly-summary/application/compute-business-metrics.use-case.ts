import { Inject, Injectable } from "@nestjs/common";
import {
  METRICS_REPOSITORY,
  type MetricsRepository,
} from "../domain/metrics.repository";
import type { BusinessMetrics } from "../domain/business-metrics";

@Injectable()
export class ComputeBusinessMetricsUseCase {
  constructor(
    @Inject(METRICS_REPOSITORY)
    private readonly metrics: MetricsRepository,
  ) {}

  execute(input: { businessId: string; weekStartsAt: string }): Promise<BusinessMetrics> {
    return this.metrics.computeMetrics(input);
  }
}
