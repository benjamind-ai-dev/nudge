export interface CreateAccountParams {
  clerkId: string;
  clerkOrganizationId: string;
  email: string;
  name: string;
  plan: null;
  status: "trial";
  maxBusinesses: number;
  trialEndsAt: Date;
}

export interface AccountProvisionRepository {
  findByClerkId(clerkId: string): Promise<{ clerkId: string } | null>;
  create(params: CreateAccountParams): Promise<void>;

  /**
   * Returns the account's clerkOrganizationId (possibly null) and the owner's
   * clerkUserId for lazy-org-create. Returns null if no account row.
   * Acquires a row-level lock for the duration of the transaction to serialize
   * concurrent lazy-create callers.
   */
  findAccountForOrgResolution(accountId: string): Promise<{
    accountId: string;
    accountName: string;
    clerkOrganizationId: string | null;
    ownerClerkUserId: string | null;
  } | null>;

  /** Persists clerkOrganizationId on an account row. */
  setClerkOrganizationId(accountId: string, clerkOrganizationId: string): Promise<void>;
}

export const ACCOUNT_PROVISION_REPOSITORY = Symbol("AccountProvisionRepository");
