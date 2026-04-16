export const QUEUE_NAMES = {
  INVOICE_SYNC: "invoice-sync",
  SEQUENCE_TRIGGER: "sequence-trigger",
  MESSAGE_SEND: "message-send",
  TOKEN_REFRESH: "token-refresh",
  DAYS_RECALC: "days-recalc",
  WEEKLY_SUMMARY: "weekly-summary",
  PAYMENT_SCORE: "payment-score",
  AI_DRAFT: "ai-draft",
  SENDGRID_EVENTS: "sendgrid-events",
  STRIPE_EVENTS: "stripe-events",
  QUICKBOOKS_WEBHOOKS: "quickbooks-webhooks",
  SMS_SEND: "sms-send",
  DEAD_LETTER: "dead-letter",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
