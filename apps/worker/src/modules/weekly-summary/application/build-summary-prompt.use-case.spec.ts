import { BuildSummaryPromptUseCase } from "./build-summary-prompt.use-case";
import type { BusinessMetrics } from "../domain/business-metrics";

const baseMetrics: BusinessMetrics = {
  weekStartsAt: "2026-05-04",
  recoveredThisWeekCents: 1_280_000,
  recoveredPriorWeekCents: 1_040_000,
  invoicesCollectedCount: 14,
  avgDaysToPayThisWeek: 32,
  avgDaysToPayTrailing4Weeks: 38,
  currentlyOverdueCount: 9,
  topOverdueCustomers: [
    { customerId: "c1", customerName: "Midwest Plastics", totalOutstandingCents: 250_000, oldestInvoiceDaysOverdue: 45 },
    { customerId: "c2", customerName: "Acme Co", totalOutstandingCents: 180_000, oldestInvoiceDaysOverdue: 30 },
  ],
  flaggedRuns: [
    { runId: "r1", customerId: "c1", customerName: "Midwest Plastics", invoiceAmountCents: 100_000 },
  ],
  activeSequencesCount: 12,
  top5OverdueInvoices: [],
};

describe("BuildSummaryPromptUseCase", () => {
  const useCase = new BuildSummaryPromptUseCase();

  it("returns a tag map and a prompt that contains no real customer names", () => {
    const result = useCase.execute(baseMetrics);
    expect(result.userPrompt).not.toContain("Midwest Plastics");
    expect(result.userPrompt).not.toContain("Acme Co");
  });

  it("uses [CUSTOMER_*] tags for every customer it references", () => {
    const result = useCase.execute(baseMetrics);
    expect(result.userPrompt).toContain("[CUSTOMER_A]");
    expect(result.userPrompt).toContain("[CUSTOMER_B]");
  });

  it("system prompt instructs the model to use bracketed tags only", () => {
    const result = useCase.execute(baseMetrics);
    expect(result.systemPrompt).toMatch(/bracketed tags/i);
    expect(result.systemPrompt).toMatch(/2.?3 sentences/i);
  });

  it("omits the flagged-runs section when there are none", () => {
    const noneFlagged: BusinessMetrics = { ...baseMetrics, flaggedRuns: [] };
    const result = useCase.execute(noneFlagged);
    expect(result.userPrompt).not.toMatch(/flagged/i);
  });
});
