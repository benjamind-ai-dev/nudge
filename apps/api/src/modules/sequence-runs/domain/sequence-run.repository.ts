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

export interface SequenceRunRepository {
  findManyByFilter(filter: SequenceRunListFilter): Promise<SequenceRunListResult>;
  findDetailById(id: string, businessId: string): Promise<SequenceRunDetail | null>;
}
