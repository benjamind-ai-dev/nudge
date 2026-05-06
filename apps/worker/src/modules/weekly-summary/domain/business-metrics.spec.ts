import { isMetricsEmpty, type BusinessMetrics } from "./business-metrics";

const baseEmpty: BusinessMetrics = {
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

describe("isMetricsEmpty", () => {
  it("is true when all signals are zero", () => {
    expect(isMetricsEmpty(baseEmpty)).toBe(true);
  });

  it("is false when there are flagged runs even if everything else is zero", () => {
    const m: BusinessMetrics = {
      ...baseEmpty,
      flaggedRuns: [{ runId: "r1", customerId: "c1", customerName: "x", invoiceAmountCents: 1000 }],
    };
    expect(isMetricsEmpty(m)).toBe(false);
  });

  it("is false when there is recovered cash", () => {
    expect(isMetricsEmpty({ ...baseEmpty, recoveredThisWeekCents: 1 })).toBe(false);
  });
});
