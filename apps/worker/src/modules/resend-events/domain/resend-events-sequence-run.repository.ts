export interface ResendEventsSequenceRunRepository {
  stopRun(runId: string, businessId: string, reason: string): Promise<void>;
  pauseRun(runId: string, businessId: string, reason: string): Promise<void>;
}

export const RESEND_EVENTS_SEQUENCE_RUN_REPOSITORY = Symbol(
  "ResendEventsSequenceRunRepository",
);
