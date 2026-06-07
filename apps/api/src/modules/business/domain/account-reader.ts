export const ACCOUNT_READER = Symbol("ACCOUNT_READER");

export interface AccountSummary {
  id: string;
  email: string;
  maxBusinesses: number;
}

export interface AccountReader {
  findById(accountId: string): Promise<AccountSummary | null>;
}
