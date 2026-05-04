-- CreateTable
CREATE TABLE "weekly_summaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "week_starts_at" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "ai_paragraph" TEXT,
    "ai_model" VARCHAR(50),
    "ai_input_tokens" INTEGER,
    "ai_output_tokens" INTEGER,
    "metrics" JSONB NOT NULL,
    "recipient_emails" TEXT[],
    "resend_message_ids" TEXT[],
    "error_message" TEXT,
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "weekly_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weekly_summaries_status_created_at_idx" ON "weekly_summaries"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_summaries_business_id_week_starts_at_key" ON "weekly_summaries"("business_id", "week_starts_at");

-- AddForeignKey
ALTER TABLE "weekly_summaries" ADD CONSTRAINT "weekly_summaries_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
