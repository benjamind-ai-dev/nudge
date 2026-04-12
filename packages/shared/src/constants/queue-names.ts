export const QUEUE_NAMES = {
  INVOICE_REMINDER: "invoice-reminder",
  SEQUENCE_STEP: "sequence-step",
  EMAIL_SEND: "email-send",
  WEBHOOK_DELIVERY: "webhook-delivery",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
