ALTER TABLE "sequence_runs" DROP CONSTRAINT "chk_sequence_runs_stopped_reason";
ALTER TABLE "sequence_runs" ADD CONSTRAINT "chk_sequence_runs_stopped_reason" CHECK ("stopped_reason" IS NULL OR "stopped_reason" IN ('payment_received', 'invoice_voided', 'manual_stop', 'email_bounced', 'client_replied'));
