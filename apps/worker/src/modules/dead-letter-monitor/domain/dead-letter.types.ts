export interface DeadLetterJob {
  originalQueue: string;
  originalJobId: string;
  data: Record<string, unknown>;
  failedReason: string;
  failedAt: string;
}

export interface StuckJob {
  queue: string;
  jobId: string;
  jobName: string;
  data: Record<string, unknown>;
  runningForMinutes: number;
}

export type AlertSeverity = "critical" | "warning" | "info";

export interface DeadLetterSummary {
  totalCount: number;
  byQueue: Record<string, number>;
  jobs: DeadLetterJob[];
  severity: AlertSeverity;
}

export type AlertChannel = "slack" | "email" | "webhook" | "console";

const CRITICAL_QUEUES = ["message-send", "token-refresh"];
const WARNING_QUEUES = ["invoice-sync", "sequence-trigger"];

export function calculateSeverity(byQueue: Record<string, number>): AlertSeverity {
  for (const queue of CRITICAL_QUEUES) {
    if (byQueue[queue] && byQueue[queue] > 0) {
      return "critical";
    }
  }
  for (const queue of WARNING_QUEUES) {
    if (byQueue[queue] && byQueue[queue] > 0) {
      return "warning";
    }
  }
  return "info";
}
