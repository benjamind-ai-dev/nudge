export interface ActiveRunForCustomer {
  runId: string;
  businessId: string;
  companyName: string;
}

export interface TwilioEventsCustomerRepository {
  findActiveRunsByContactPhone(phoneDigits: string): Promise<ActiveRunForCustomer[]>;
}

export interface TwilioEventsSequenceRunRepository {
  /** Returns true if the run was active and is now stopped; false if it was
   *  already terminal (so the caller can skip side-effects like alerts). */
  stopRun(runId: string, businessId: string, reason: string): Promise<boolean>;
}

/**
 * `ownerEmail` is PII. Use only as an email recipient — never log, never send to
 * the Claude API, never pass to analytics.
 */
export interface BusinessWithOwner {
  name: string;
  ownerEmail: string;
}

export interface TwilioEventsBusinessRepository {
  findWithOwner(businessId: string): Promise<BusinessWithOwner | null>;
}

export const TWILIO_EVENTS_CUSTOMER_REPOSITORY = Symbol(
  "TwilioEventsCustomerRepository",
);
export const TWILIO_EVENTS_SEQUENCE_RUN_REPOSITORY = Symbol(
  "TwilioEventsSequenceRunRepository",
);
export const TWILIO_EVENTS_BUSINESS_REPOSITORY = Symbol(
  "TwilioEventsBusinessRepository",
);
