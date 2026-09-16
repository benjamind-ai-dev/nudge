export const BUSINESS_OWNERSHIP_REPOSITORY = Symbol("BusinessOwnershipRepository");

export interface BusinessOwnership {
  /** false once the business has been soft-deleted (disconnect / cleanup). */
  isActive: boolean;
  /** Billing status of the owning account (`trial`, `active`, `past_due`, ...). */
  accountStatus: string;
}

export interface BusinessOwnershipRepository {
  /** null when the business does not exist or belongs to a different account. */
  findForAccount(businessId: string, accountId: string): Promise<BusinessOwnership | null>;
}
