-- AlterTable: Add sequenceId to relationship_tiers
ALTER TABLE "relationship_tiers" ADD COLUMN "sequence_id" UUID;

-- AlterTable: Add sequenceId to customers
ALTER TABLE "customers" ADD COLUMN "sequence_id" UUID;

-- AlterTable: Modify Sequence model
-- Make relationshipTierId nullable
ALTER TABLE "sequences" ALTER COLUMN "relationship_tier_id" DROP NOT NULL;

-- Drop isActive column
ALTER TABLE "sequences" DROP COLUMN "is_active";

-- Add FK constraints for new FKs
ALTER TABLE "relationship_tiers" ADD CONSTRAINT "relationship_tiers_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "sequences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customers" ADD CONSTRAINT "customers_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "sequences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update Sequence -> RelationshipTier constraint to allow NULL and use SetNull
ALTER TABLE "sequences" DROP CONSTRAINT "sequences_relationship_tier_id_fkey";
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_relationship_tier_id_fkey" FOREIGN KEY ("relationship_tier_id") REFERENCES "relationship_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
