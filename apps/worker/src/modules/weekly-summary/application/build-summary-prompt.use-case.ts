import { Injectable } from "@nestjs/common";
import { CustomerTagMap, type CustomerEntry } from "../domain/customer-tag-map";
import type { BusinessMetrics } from "../domain/business-metrics";

export interface BuildSummaryPromptResult {
  systemPrompt: string;
  userPrompt: string;
  tagMap: CustomerTagMap;
}

@Injectable()
export class BuildSummaryPromptUseCase {
  execute(metrics: BusinessMetrics): BuildSummaryPromptResult {
    const entries: CustomerEntry[] = [
      ...metrics.topOverdueCustomers.map((c) => ({
        id: c.customerId,
        name: c.customerName,
        outstandingCents: c.totalOutstandingCents,
      })),
      ...metrics.flaggedRuns.map((r) => ({
        id: r.customerId,
        name: r.customerName,
        outstandingCents: r.invoiceAmountCents,
      })),
    ];

    const tagMap = CustomerTagMap.fromEntries(entries);

    const systemPrompt =
      "You are a cash flow analyst writing a brief weekly summary for a small business owner. " +
      "Be direct, specific, and actionable. No fluff. 2-3 sentences max. " +
      "Refer to customers only by their bracketed tags exactly as given (e.g., [CUSTOMER_A]). " +
      "Do not invent customer names, paraphrase tags, or reference customers that were not given to you.";

    const lines: string[] = [];
    lines.push(`Week starting ${metrics.weekStartsAt}.`);
    lines.push(
      `Recovered this week: $${(metrics.recoveredThisWeekCents / 100).toFixed(2)} ` +
        `(prior week: $${(metrics.recoveredPriorWeekCents / 100).toFixed(2)}).`,
    );
    lines.push(`Invoices collected: ${metrics.invoicesCollectedCount}.`);
    if (metrics.avgDaysToPayThisWeek !== null && metrics.avgDaysToPayTrailing4Weeks !== null) {
      lines.push(
        `Avg days to pay this week: ${metrics.avgDaysToPayThisWeek}, trailing 4 weeks: ${metrics.avgDaysToPayTrailing4Weeks}.`,
      );
    }
    lines.push(`Currently overdue invoices: ${metrics.currentlyOverdueCount}.`);
    lines.push(`Active sequences: ${metrics.activeSequencesCount}.`);

    if (metrics.topOverdueCustomers.length > 0) {
      lines.push("Top overdue customers (by outstanding):");
      for (const c of metrics.topOverdueCustomers) {
        const tag = tagMap.tagFor(c.customerId);
        lines.push(
          `  - ${tag}: $${(c.totalOutstandingCents / 100).toFixed(2)} outstanding, oldest invoice ${c.oldestInvoiceDaysOverdue} days overdue`,
        );
      }
    }

    if (metrics.flaggedRuns.length > 0) {
      lines.push("Flagged sequence runs (completed all steps with no payment):");
      for (const r of metrics.flaggedRuns) {
        const tag = tagMap.tagFor(r.customerId);
        lines.push(`  - ${tag}: invoice $${(r.invoiceAmountCents / 100).toFixed(2)}`);
      }
    }

    return { systemPrompt, userPrompt: lines.join("\n"), tagMap };
  }
}
