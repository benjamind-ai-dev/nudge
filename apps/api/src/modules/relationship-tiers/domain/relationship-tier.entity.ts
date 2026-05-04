export interface RelationshipTier {
  id: string;
  businessId: string;
  sequenceId: string | null;
  sequenceName: string | null;
  name: string;
  description: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
