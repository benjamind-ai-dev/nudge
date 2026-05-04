import type { BusinessMetrics } from "../../domain/business-metrics";

export const SUMMARY_RENDERER = Symbol("SUMMARY_RENDERER");

export interface SummaryRenderer {
  render(input: {
    businessName: string;
    weekStartsAt: string;
    aiParagraph: string | null;
    metrics: BusinessMetrics;
    dashboardUrl: string;
  }): { html: string; text: string };
}
