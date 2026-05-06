import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import Handlebars from "handlebars";
import type { BusinessMetrics } from "../domain/business-metrics";
import type { SummaryRenderer } from "../application/ports/summary-renderer";

const TEMPLATE_PATH = path.resolve(__dirname, "templates", "weekly-summary.hbs");

@Injectable()
export class HandlebarsSummaryRenderer implements SummaryRenderer {
  private readonly compiled: Handlebars.TemplateDelegate;

  constructor() {
    const source = fs.readFileSync(TEMPLATE_PATH, "utf8");
    this.compiled = Handlebars.compile(source);
  }

  render(input: {
    businessName: string;
    weekStartsAt: string;
    aiParagraph: string | null;
    metrics: BusinessMetrics;
    dashboardUrl: string;
  }): { html: string; text: string } {
    const m = input.metrics;
    const recoveryDeltaPct = computeDeltaPct(m.recoveredThisWeekCents, m.recoveredPriorWeekCents);

    const data = {
      businessName: input.businessName,
      weekStartsAt: input.weekStartsAt,
      aiParagraph: input.aiParagraph,
      dashboardUrl: input.dashboardUrl,
      recoveredThisWeekUsd: (m.recoveredThisWeekCents / 100).toFixed(2),
      recoveryDeltaPct,
      invoicesCollectedCount: m.invoicesCollectedCount,
      avgDaysToPayThisWeek: m.avgDaysToPayThisWeek,
      avgDaysToPayTrailing4Weeks: m.avgDaysToPayTrailing4Weeks,
      activeSequencesCount: m.activeSequencesCount,
      hasOverdueRows: m.top5OverdueInvoices.length > 0,
      top5OverdueInvoices: m.top5OverdueInvoices.map((row) => ({
        customerName: row.customerName,
        amountUsd: (row.amountCents / 100).toFixed(2),
        daysOverdue: row.daysOverdue,
        currentSequenceStep: row.currentSequenceStep,
      })),
    };

    const html = this.compiled(data);
    const text = renderText(input, recoveryDeltaPct);
    return { html, text };
  }
}

function computeDeltaPct(thisWeek: number, prior: number): string {
  if (prior === 0) return thisWeek > 0 ? "new" : "0%";
  const pct = Math.round(((thisWeek - prior) / prior) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

function renderText(
  input: { businessName: string; weekStartsAt: string; aiParagraph: string | null; metrics: BusinessMetrics; dashboardUrl: string },
  deltaPct: string,
): string {
  const m = input.metrics;
  const lines = [
    `Nudge weekly summary — ${input.businessName} — week of ${input.weekStartsAt}`,
    "",
  ];
  if (input.aiParagraph) lines.push(input.aiParagraph, "");
  lines.push(
    `Recovered this week: $${(m.recoveredThisWeekCents / 100).toFixed(2)} (${deltaPct})`,
    `Invoices collected: ${m.invoicesCollectedCount}`,
  );
  if (m.avgDaysToPayThisWeek !== null) {
    lines.push(`Avg days to pay: ${m.avgDaysToPayThisWeek} (4-wk avg ${m.avgDaysToPayTrailing4Weeks})`);
  }
  lines.push(`Active sequences: ${m.activeSequencesCount}`, "");
  if (m.top5OverdueInvoices.length > 0) {
    lines.push("Top overdue invoices:");
    for (const r of m.top5OverdueInvoices) {
      lines.push(`  - ${r.customerName}: $${(r.amountCents / 100).toFixed(2)}, ${r.daysOverdue} days overdue`);
    }
    lines.push("");
  }
  lines.push(`View full report: ${input.dashboardUrl}`);
  return lines.join("\n");
}
