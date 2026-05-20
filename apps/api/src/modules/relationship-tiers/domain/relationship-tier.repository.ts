import type { RelationshipTier } from "./relationship-tier.entity";

export const RELATIONSHIP_TIER_REPOSITORY = Symbol("RelationshipTierRepository");

export interface UpdateTierData {
  name?: string;
  description?: string | null;
  sequenceId?: string | null;
  isDefault?: boolean;
  sortOrder?: number;
}

export interface CreateTierData {
  name: string;
  description?: string | null;
}

export interface RelationshipTierRepository {
  findAllByBusiness(businessId: string): Promise<RelationshipTier[]>;
  findById(id: string, businessId: string): Promise<RelationshipTier | null>;
  nameExistsInBusiness(
    name: string,
    businessId: string,
    exceptId?: string,
  ): Promise<boolean>;
  countByBusiness(businessId: string): Promise<number>;
  create(businessId: string, data: CreateTierData): Promise<RelationshipTier>;
  update(id: string, businessId: string, data: UpdateTierData): Promise<RelationshipTier>;
  hasActiveSequenceRuns(tierId: string, businessId: string): Promise<boolean>;
  delete(id: string, businessId: string): Promise<void>;
}
