import { HandlebarsSummaryRenderer } from "./handlebars-summary-renderer";
import type { BusinessMetrics } from "../domain/business-metrics";

const baseMetrics: BusinessMetrics = {
  weekStartsAt: "2026-05-04",
  recoveredThisWeekCents: 1_280_000,
  recoveredPriorWeekCents: 1_040_000,
  invoicesCollectedCount: 14,
  avgDaysToPayThisWeek: 32,
  avgDaysToPayTrailing4Weeks: 38,
  currentlyOverdueCount: 9,
  topOverdueCustomers: [],
  flaggedRuns: [],
  activeSequencesCount: 12,
  top5OverdueInvoices: [
    { customerName: "Midwest Plastics", amountCents: 250_000, daysOverdue: 45, currentSequenceStep: 3 },
  ],
};

describe("HandlebarsSummaryRenderer", () => {
  const renderer = new HandlebarsSummaryRenderer();

  it("renders the AI paragraph when provided", () => {
    const out = renderer.render({
      businessName: "Sandra's Bakery",
      weekStartsAt: "2026-05-04",
      aiParagraph: "Recovery is up; chase Midwest Plastics this week.",
      metrics: baseMetrics,
      dashboardUrl: "https://app.nudge.io/dashboard",
    });
    expect(out.html).toContain("Recovery is up; chase Midwest Plastics this week.");
    expect(out.text).toContain("Recovery is up");
  });

  it("omits the AI paragraph when null", () => {
    const out = renderer.render({
      businessName: "Sandra's Bakery",
      weekStartsAt: "2026-05-04",
      aiParagraph: null,
      metrics: baseMetrics,
      dashboardUrl: "https://app.nudge.io/dashboard",
    });
    expect(out.html).not.toContain("Recovery is up");
  });

  it("renders the overdue invoices table", () => {
    const out = renderer.render({
      businessName: "Sandra's Bakery",
      weekStartsAt: "2026-05-04",
      aiParagraph: null,
      metrics: baseMetrics,
      dashboardUrl: "https://app.nudge.io/dashboard",
    });
    expect(out.html).toContain("Midwest Plastics");
    expect(out.html).toContain("2500.00");
    expect(out.html).toContain("45");
  });

  it("omits the table block when there are no overdue invoices", () => {
    const out = renderer.render({
      businessName: "Sandra's Bakery",
      weekStartsAt: "2026-05-04",
      aiParagraph: null,
      metrics: { ...baseMetrics, top5OverdueInvoices: [] },
      dashboardUrl: "https://app.nudge.io/dashboard",
    });
    expect(out.html).not.toContain("Top overdue invoices");
  });

  it("computes WoW delta when prior week is zero", () => {
    const out = renderer.render({
      businessName: "x",
      weekStartsAt: "2026-05-04",
      aiParagraph: null,
      metrics: { ...baseMetrics, recoveredPriorWeekCents: 0 },
      dashboardUrl: "x",
    });
    expect(out.html).toContain("(new)");
  });
});
