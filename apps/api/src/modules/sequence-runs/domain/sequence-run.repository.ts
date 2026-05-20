import type {
  SequenceRunDetail,
  SequenceRunListItem,
  SequenceRunStatus,
} from "./sequence-run.entity";

export const SEQUENCE_RUN_REPOSITORY = Symbol("SequenceRunRepository");

export interface SequenceRunListFilter {
  businessId: string;
  page: number;
  limit: number;
  status?: SequenceRunStatus;
  customerId?: string;
  invoiceId?: string;
}

export interface SequenceRunListResult {
  items: SequenceRunListItem[];
  total: number;
}

export interface SequenceRunActionContext {
  id: string;
  status: SequenceRunStatus;
  invoice: {
    invoiceNumber: string | null;
    businessTimezone: string;
  };
  customer: {
    companyName: string;
  };
}

export interface SequenceRunRepository {
  findManyByFilter(filter: SequenceRunListFilter): Promise<SequenceRunListResult>;
  findDetailById(id: string, businessId: string): Promise<SequenceRunDetail | null>;
  // Returns the minimal data needed to transition + log. Includes business timezone
  // so the resume use case can compute next_send_at with nextBusinessHour.
  findActionContext(id: string, businessId: string): Promise<SequenceRunActionContext | null>;
  // Each transition returns true if the update affected one row. The where-clause
  // includes the expected source status, so a concurrent change yields false.
  pause(id: string, businessId: string, pausedReason: string): Promise<boolean>;
  resume(id: string, businessId: string, nextSendAt: Date): Promise<boolean>;
  stop(id: string, businessId: string, stoppedReason: string, completedAt: Date): Promise<boolean>;
}
