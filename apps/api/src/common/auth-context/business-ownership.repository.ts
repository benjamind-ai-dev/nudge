export const BUSINESS_OWNERSHIP_REPOSITORY = Symbol("BusinessOwnershipRepository");

export interface BusinessOwnershipRepository {
  existsForAccount(businessId: string, accountId: string): Promise<boolean>;
}
