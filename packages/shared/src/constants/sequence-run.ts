export const STOPPED_REASONS = {
  PAYMENT_RECEIVED: "payment_received",
  INVOICE_VOIDED: "invoice_voided",
  CLIENT_REPLIED: "client_replied",
  MANUALLY_STOPPED: "manually_stopped",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",
} as const;

export type StoppedReason =
  (typeof STOPPED_REASONS)[keyof typeof STOPPED_REASONS];

export const SEQUENCE_RUN_STATUSES = {
  ACTIVE: "active",
  PAUSED: "paused",
  STOPPED: "stopped",
  COMPLETED: "completed",
} as const;

export type SequenceRunStatus =
  (typeof SEQUENCE_RUN_STATUSES)[keyof typeof SEQUENCE_RUN_STATUSES];
