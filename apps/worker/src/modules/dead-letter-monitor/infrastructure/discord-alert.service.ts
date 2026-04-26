import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AlertService, AlertPayload } from "../domain/alert.service";
import type { DeadLetterJob, StuckJob, AlertSeverity } from "../domain/dead-letter.types";

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  critical: "🔴",
  warning: "🟡",
  info: "🔵",
};

@Injectable()
export class DiscordAlertService implements AlertService {
  private readonly logger = new Logger(DiscordAlertService.name);
  private readonly webhookUrl: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.webhookUrl = this.config.get<string>("ALERT_DISCORD_WEBHOOK_URL");
  }

  async send(payload: AlertPayload): Promise<void> {
    const message = this.formatMessage(payload);

    if (this.webhookUrl) {
      await this.sendToDiscord(message);
    } else {
      this.logToConsole(payload, message);
    }
  }

  private async sendToDiscord(message: string): Promise<void> {
    try {
      const response = await fetch(this.webhookUrl!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook returned ${response.status}`);
      }

      this.logger.log({
        msg: "Alert sent to Discord",
        event: "discord_alert_sent",
      });
    } catch (error) {
      this.logger.error({
        msg: "Failed to send Discord alert, falling back to console",
        event: "discord_alert_failed",
        error: error instanceof Error ? error.message : String(error),
      });
      this.logToConsole({ summary: { totalCount: 0, byQueue: {}, jobs: [], severity: "info" }, stuckJobs: [] }, message);
    }
  }

  private logToConsole(payload: AlertPayload, formattedMessage: string): void {
    this.logger.warn({
      msg: "DEAD LETTER ALERT (Discord not configured)",
      event: "dead_letter_alert_console",
      deadJobCount: payload.summary.totalCount,
      stuckJobCount: payload.stuckJobs.length,
      severity: payload.summary.severity,
      byQueue: payload.summary.byQueue,
      formattedMessage,
    });
  }

  private formatMessage(payload: AlertPayload): string {
    const { summary, stuckJobs } = payload;
    const emoji = SEVERITY_EMOJI[summary.severity];
    const severityLabel = summary.severity.toUpperCase();

    const lines: string[] = [];

    const totalIssues = summary.totalCount + stuckJobs.length;
    lines.push(`${emoji} **${severityLabel}: ${totalIssues} job issue(s) detected**`);
    lines.push("");

    if (summary.totalCount > 0) {
      lines.push("**Dead Jobs (last 24h):**");
      for (const [queue, count] of Object.entries(summary.byQueue)) {
        lines.push(`• \`${queue}\`: ${count} job(s)`);
      }
      lines.push("");
    }

    if (stuckJobs.length > 0) {
      lines.push("**⚠️ Stuck Jobs (running >30min):**");
      for (const job of stuckJobs) {
        lines.push(`• \`${job.queue}\`: ${job.jobName} (${job.runningForMinutes}min)`);
      }
      lines.push("");
    }

    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const jobsToShow = summary.jobs.slice(0, 10);
    for (const job of jobsToShow) {
      lines.push("");
      lines.push(this.formatDeadJob(job));
    }

    if (summary.jobs.length > 10) {
      lines.push("");
      lines.push(`_...and ${summary.jobs.length - 10} more dead jobs_`);
    }

    for (const job of stuckJobs.slice(0, 5)) {
      lines.push("");
      lines.push(this.formatStuckJob(job));
    }

    if (stuckJobs.length > 5) {
      lines.push("");
      lines.push(`_...and ${stuckJobs.length - 5} more stuck jobs_`);
    }

    return lines.join("\n");
  }

  private formatDeadJob(job: DeadLetterJob): string {
    const businessId = (job.data as { businessId?: string }).businessId ?? "unknown";
    const errorTruncated = job.failedReason.slice(0, 200);
    const failedAt = new Date(job.failedAt).toUTCString();

    return [
      `**[${job.originalQueue}]** \`${job.originalJobId}\``,
      `Business: \`${businessId}\``,
      `Error: ${errorTruncated}`,
      `Failed: ${failedAt}`,
    ].join("\n");
  }

  private formatStuckJob(job: StuckJob): string {
    const businessId = (job.data as { businessId?: string }).businessId ?? "unknown";

    return [
      `**⚠️ [${job.queue}]** \`${job.jobId}\` — STUCK`,
      `Job: ${job.jobName}`,
      `Business: \`${businessId}\``,
      `Running for: ${job.runningForMinutes} minutes`,
    ].join("\n");
  }
}
