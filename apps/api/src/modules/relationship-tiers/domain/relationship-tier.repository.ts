import type { RelationshipTier } from "./relationship-tier.entity";

export const RELATIONSHIP_TIER_REPOSITORY = Symbol("RelationshipTierRepository");

export interface UpdateTierData {
  name?: string;
  description?: string | null;
  sequenceId?: string | null;
}

export interface RelationshipTierRepository {
  findAllByBusiness(businessId: string): Promise<RelationshipTier[]>;
  update(id: string, businessId: string, data: UpdateTierData): Promise<RelationshipTier>;
}
