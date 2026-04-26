import type { DeadLetterSummary, StuckJob } from "./dead-letter.types";

export interface AlertPayload {
  summary: DeadLetterSummary;
  stuckJobs: StuckJob[];
}

export interface AlertService {
  send(payload: AlertPayload): Promise<void>;
}

export const ALERT_SERVICE = Symbol("AlertService");
