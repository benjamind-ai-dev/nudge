export interface CreateAccountParams {
  clerkId: string;
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
}

export const ACCOUNT_PROVISION_REPOSITORY = Symbol("AccountProvisionRepository");
