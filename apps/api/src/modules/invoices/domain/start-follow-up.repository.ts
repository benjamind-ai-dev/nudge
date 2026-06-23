export interface FollowUpContext {
  status: string;
  dueDate: Date;
  businessTimezone: string;
  customerId: string;
  customerSequenceId: string | null;
  customerSequenceIsActive: boolean | null;
  customerTierSequenceId: string | null;
  customerTierSequenceIsActive: boolean | null;
}

export interface SequenceFirstStep {
  firstStepId: string;
  firstStepDelayDays: number;
}

export interface CreateSequenceRunData {
  invoiceId: string;
  businessId: string;
  sequenceId: string;
  currentStepId: string;
  status: "active";
  nextSendAt: Date;
  startedAt: Date;
  firstStepSubject: string | null;
  firstStepBody: string | null;
  firstStepIncludePaymentLink: boolean | null;
  firstStepSkip: boolean | null;
}

export interface StartFollowUpRepository {
  getFollowUpContext(invoiceId: string, businessId: string): Promise<FollowUpContext | null>;
  findDefaultTierSequenceId(businessId: string): Promise<string | null>;
  /** Last-resort fallback: the oldest active sequence for the business, or null if none. */
  findAnyActiveSequenceId(businessId: string): Promise<string | null>;
  findSequenceFirstStep(sequenceId: string): Promise<SequenceFirstStep | null>;
  createSequenceRun(
    data: CreateSequenceRunData,
  ): Promise<{ created: boolean; runId: string | null }>;
}

export const START_FOLLOW_UP_REPOSITORY = Symbol("StartFollowUpRepository");
