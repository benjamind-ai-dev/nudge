-- AlterTable
ALTER TABLE "sequence_steps" ADD COLUMN     "sms_body_template" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "idx_messages_run_step_channel" ON "messages"("sequence_run_id", "sequence_step_id", "channel");
