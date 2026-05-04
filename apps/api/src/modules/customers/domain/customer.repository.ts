import type { Customer } from "./customer.entity";

export const CUSTOMER_REPOSITORY = Symbol("CustomerRepository");

export interface UpdateCustomerData {
  relationshipTierId?: string | null;
  sequenceId?: string | null;
}

export interface CustomerRepository {
  findAllByBusiness(businessId: string): Promise<Customer[]>;
  update(id: string, businessId: string, data: UpdateCustomerData): Promise<Customer>;
}
