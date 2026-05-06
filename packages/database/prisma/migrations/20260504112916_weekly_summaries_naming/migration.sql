-- AlterTable
ALTER TABLE "weekly_summaries" ALTER COLUMN "recipient_emails" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "resend_message_ids" SET DEFAULT ARRAY[]::TEXT[];

-- RenameIndex
ALTER INDEX "weekly_summaries_business_id_week_starts_at_key" RENAME TO "idx_weekly_summaries_business_week";

-- RenameIndex
ALTER INDEX "weekly_summaries_status_created_at_idx" RENAME TO "idx_weekly_summaries_status";
