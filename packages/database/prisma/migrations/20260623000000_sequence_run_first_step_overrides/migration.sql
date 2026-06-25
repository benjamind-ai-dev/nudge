-- AlterTable
ALTER TABLE "sequence_runs" ADD COLUMN "first_step_subject" TEXT,
ADD COLUMN "first_step_body" TEXT,
ADD COLUMN "first_step_include_payment_link" BOOLEAN,
ADD COLUMN "first_step_skip" BOOLEAN;
