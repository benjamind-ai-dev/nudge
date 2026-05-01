export interface ActiveRunForCustomer {
  runId: string;
  businessId: string;
}

export interface ResendEventsCustomerRepository {
  findActiveRunsByContactEmail(email: string): Promise<ActiveRunForCustomer[]>;
}

export const RESEND_EVENTS_CUSTOMER_REPOSITORY = Symbol(
  "ResendEventsCustomerRepository",
);
