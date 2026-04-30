/**
 * Repository for business data used in Resend event processing.
 *
 * IMPORTANT: `ownerEmail` is PII. It must never be logged, sent to the Claude API,
 * or passed to any external service other than the transactional email provider
 * (Resend). Anonymize before any AI/analytics use.
 */

export interface BusinessWithOwner {
  /** Business display name — safe for logging. */
  name: string;
  /**
   * Owner's email address — PII. Use only as an email recipient.
   * Never log, never send to Claude API, never pass to analytics.
   */
  ownerEmail: string;
}

export interface ResendEventsBusinessRepository {
  /**
   * Returns the business name and owner email for sending transactional email.
   * The returned `ownerEmail` is PII — handle accordingly.
   */
  findWithOwner(businessId: string): Promise<BusinessWithOwner | null>;
}

export const RESEND_EVENTS_BUSINESS_REPOSITORY = Symbol(
  "ResendEventsBusinessRepository",
);
