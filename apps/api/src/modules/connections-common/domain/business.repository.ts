export const BUSINESS_REPOSITORY = Symbol("BUSINESS_REPOSITORY");

export interface BusinessSummary {
  id: string;
}

export interface BusinessRepository {
  findById(id: string): Promise<BusinessSummary | null>;
}
