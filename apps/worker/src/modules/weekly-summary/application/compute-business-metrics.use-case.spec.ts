import { ComputeBusinessMetricsUseCase } from "./compute-business-metrics.use-case";
import type { MetricsRepository } from "../domain/metrics.repository";
import type { BusinessMetrics } from "../domain/business-metrics";

const sampleMetrics: BusinessMetrics = {
  weekStartsAt: "2026-05-04",
  recoveredThisWeekCents: 0,
  recoveredPriorWeekCents: 0,
  invoicesCollectedCount: 0,
  avgDaysToPayThisWeek: null,
  avgDaysToPayTrailing4Weeks: null,
  currentlyOverdueCount: 0,
  topOverdueCustomers: [],
  flaggedRuns: [],
  activeSequencesCount: 0,
  top5OverdueInvoices: [],
};

describe("ComputeBusinessMetricsUseCase", () => {
  it("delegates to the metrics repository with the given business + week", async () => {
    const repo: Pick<MetricsRepository, "computeMetrics"> = {
      computeMetrics: jest.fn().mockResolvedValue(sampleMetrics),
    };
    const useCase = new ComputeBusinessMetricsUseCase(repo as MetricsRepository);

    const result = await useCase.execute({ businessId: "b1", weekStartsAt: "2026-05-04" });

    expect(repo.computeMetrics).toHaveBeenCalledWith({
      businessId: "b1",
      weekStartsAt: "2026-05-04",
    });
    expect(result).toBe(sampleMetrics);
  });
});
