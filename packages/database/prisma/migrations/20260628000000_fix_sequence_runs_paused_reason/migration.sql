ALTER TABLE "sequence_runs" DROP CONSTRAINT "chk_sequence_runs_paused_reason";
ALTER TABLE "sequence_runs" ADD CONSTRAINT "chk_sequence_runs_paused_reason" CHECK ("paused_reason" IS NULL OR "paused_reason" IN ('spam_complaint', 'manual_pause', 'sequence_paused'));
