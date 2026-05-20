export interface DevAccountListingRepository {
  /** Returns account ids that have no clerk_organization_id set yet. */
  listAccountsMissingClerkOrg(): Promise<string[]>;
}

export const DEV_ACCOUNT_LISTING_REPOSITORY = Symbol(
  "DevAccountListingRepository",
);
