export interface InvoiceSyncJobData {
  businessId: string;
}

export type SequenceTriggerJobData = Record<string, never>;

export interface MessageSendJobData {
  sequenceRunId: string;
  businessId: string;
}

export interface TokenRefreshJobData {
  connectionId: string;
  businessId: string;
}

export type DaysRecalcJobData = Record<string, never>;

export interface WeeklySummaryJobData {
  businessId: string;
}

export interface PaymentScoreJobData {
  invoiceId: string;
  businessId: string;
}

export interface AiDraftJobData {
  messageId: string;
  businessId: string;
}

export interface ResendEventsJobData {
  payload: unknown[];
}

export interface StripeEventsJobData {
  eventId: string;
  eventType: string;
}

export interface QuickbooksWebhooksJobData {
  businessId: string;
  realmId: string;
}

export interface DeadLetterJobData {
  originalQueue: string;
  originalJobId: string | undefined;
  data: unknown;
  failedReason: string;
  failedAt: string;
}

export interface SmsSendJobData {
  to: string;
  body: string;
  businessId: string;
  invoiceId?: string;
  sequenceStepId?: string;
}

export interface RefreshConnectionJobData {
  connectionId: string;
  businessId: string;
}
