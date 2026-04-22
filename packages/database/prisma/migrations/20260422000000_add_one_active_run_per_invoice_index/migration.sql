-- CreateIndex
CREATE UNIQUE INDEX "idx_one_active_run_per_invoice" 
ON "sequence_runs" ("invoice_id") 
WHERE status IN ('active', 'paused');
