export interface ApiResponse<T> {
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface HealthCheck {
  status: "ok";
  version: string;
}

export type {
  InvoiceSyncJobData,
  SequenceTriggerJobData,
  MessageSendJobData,
  TokenRefreshJobData,
  DaysRecalcJobData,
  WeeklySummaryJobData,
  PaymentScoreJobData,
  AiDraftJobData,
  SendgridEventsJobData,
  StripeEventsJobData,
  QuickbooksWebhooksJobData,
  DeadLetterJobData,
  SmsSendJobData,
} from "./jobs";
