export interface Customer {
  id: string;
  businessId: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  relationshipTierId: string | null;
  tierName: string | null;
  sequenceId: string | null;
  sequenceName: string | null;
  totalOutstanding: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
