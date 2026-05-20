import type {
  Customer,
  CustomerDetail,
  CustomerListSortField,
  CustomerListSortOrder,
} from "./customer.entity";

export const CUSTOMER_REPOSITORY = Symbol("CustomerRepository");

export interface CustomerListFilter {
  businessId: string;
  page: number;
  limit: number;
  search?: string;
  tierId?: string;
  hasOverdue?: boolean;
  includeInactive: boolean;
  sortBy: CustomerListSortField;
  sortOrder: CustomerListSortOrder;
}

export interface CustomerListResult {
  items: Customer[];
  total: number;
}

export interface UpdateCustomerData {
  relationshipTierId?: string | null;
  sequenceId?: string | null;
}

export interface CustomerRepository {
  findManyByFilter(filter: CustomerListFilter): Promise<CustomerListResult>;
  findDetailById(id: string, businessId: string): Promise<CustomerDetail | null>;
  update(id: string, businessId: string, data: UpdateCustomerData): Promise<Customer>;
  tierBelongsToBusiness(tierId: string, businessId: string): Promise<boolean>;
  sequenceBelongsToBusiness(sequenceId: string, businessId: string): Promise<boolean>;
}
