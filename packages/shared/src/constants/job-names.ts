export const JOB_NAMES = {
  MESSAGE_SEND_TICK: "message-send-tick",
  SEND_MESSAGE: "send-message",
  SEQUENCE_TRIGGER_TICK: "sequence-trigger-tick",
  DEAD_LETTER_CHECK_TICK: "dead-letter-check-tick",
  DAYS_RECALC_TICK: "days-recalc-tick",
  WEEKLY_SUMMARY_DISPATCH: "weekly-summary-dispatch",
  WEEKLY_SUMMARY_BUSINESS: "weekly-summary-business",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
