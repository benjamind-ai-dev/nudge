export interface ActiveRunForCustomer {
  runId: string;
  businessId: string;
  companyName: string;
}

export interface ResendEventsCustomerRepository {
  findActiveRunsByContactEmail(email: string): Promise<ActiveRunForCustomer[]>;
}

export const RESEND_EVENTS_CUSTOMER_REPOSITORY = Symbol(
  "ResendEventsCustomerRepository",
);
