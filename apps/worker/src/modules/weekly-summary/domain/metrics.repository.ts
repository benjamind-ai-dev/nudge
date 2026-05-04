import type { BusinessMetrics } from "./business-metrics";

export const METRICS_REPOSITORY = Symbol("METRICS_REPOSITORY");

export interface OwnerRecipient {
  userId: string;
  email: string;
}

export interface BusinessReadModel {
  id: string;
  accountId: string;
  name: string;
  timezone: string;
  senderEmail: string;
  senderName: string;
}

export interface MetricsRepository {
  loadBusiness(businessId: string): Promise<BusinessReadModel | null>;

  loadOwnerRecipients(accountId: string): Promise<OwnerRecipient[]>;

  /** Compute the metrics for a 7-day window ending strictly before `weekStartsAt`. */
  computeMetrics(input: {
    businessId: string;
    weekStartsAt: string;
  }): Promise<BusinessMetrics>;
}
