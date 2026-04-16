-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "plan" VARCHAR(50) NOT NULL,
    "stripe_customer_id" VARCHAR(255),
    "stripe_subscription_id" VARCHAR(255),
    "trial_ends_at" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL,
    "max_businesses" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "accounting_provider" VARCHAR(50) NOT NULL,
    "sender_name" VARCHAR(255) NOT NULL,
    "sender_email" VARCHAR(255) NOT NULL,
    "email_signature" TEXT,
    "timezone" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMPTZ NOT NULL,
    "realm_id" VARCHAR(255),
    "scopes" TEXT,
    "sync_cursor" TEXT,
    "last_refresh_at" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "contact_name" VARCHAR(255),
    "contact_email" VARCHAR(255),
    "contact_phone" VARCHAR(50),
    "relationship_tier_id" UUID,
    "payment_terms" VARCHAR(50),
    "avg_days_to_pay" DECIMAL(8,2),
    "total_outstanding" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "invoice_number" VARCHAR(100),
    "amount_cents" INTEGER NOT NULL,
    "amount_paid_cents" INTEGER NOT NULL DEFAULT 0,
    "balance_due_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "due_date" DATE NOT NULL,
    "issued_date" DATE,
    "status" VARCHAR(30) NOT NULL,
    "payment_link_url" TEXT,
    "days_overdue" INTEGER NOT NULL DEFAULT 0,
    "ai_payment_score" INTEGER,
    "ai_score_reason" TEXT,
    "paid_at" TIMESTAMPTZ,
    "last_synced_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_tiers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "relationship_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "relationship_tier_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sequence_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "delay_days" INTEGER NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "subject_template" TEXT,
    "body_template" TEXT NOT NULL,
    "is_owner_alert" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sequence_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL,
    "sequence_id" UUID NOT NULL,
    "current_step_id" UUID,
    "status" VARCHAR(20) NOT NULL,
    "paused_reason" VARCHAR(50),
    "next_send_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "stopped_reason" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sequence_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sequence_run_id" UUID NOT NULL,
    "sequence_step_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "recipient_email" VARCHAR(255),
    "recipient_phone" VARCHAR(50),
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "external_message_id" VARCHAR(255),
    "opened_at" TIMESTAMPTZ,
    "clicked_at" TIMESTAMPTZ,
    "replied_at" TIMESTAMPTZ,
    "reply_body" TEXT,
    "ai_draft_response" TEXT,
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "connections_business_id_key" ON "connections"("business_id");

-- CreateIndex
CREATE INDEX "idx_connections_refresh" ON "connections"("status", "token_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idx_customers_external" ON "customers"("business_id", "external_id");

-- CreateIndex
CREATE INDEX "idx_invoices_overdue" ON "invoices"("business_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "idx_invoices_customer" ON "invoices"("customer_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "idx_invoices_external" ON "invoices"("business_id", "external_id");

-- CreateIndex
CREATE INDEX "idx_runs_next_send" ON "sequence_runs"("status", "next_send_at");

-- CreateIndex
CREATE INDEX "idx_runs_invoice" ON "sequence_runs"("invoice_id", "status");

-- CreateIndex
CREATE INDEX "idx_messages_business_sent" ON "messages"("business_id", "sent_at");

-- CreateIndex
CREATE INDEX "idx_messages_external" ON "messages"("external_message_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_relationship_tier_id_fkey" FOREIGN KEY ("relationship_tier_id") REFERENCES "relationship_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_tiers" ADD CONSTRAINT "relationship_tiers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_relationship_tier_id_fkey" FOREIGN KEY ("relationship_tier_id") REFERENCES "relationship_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_runs" ADD CONSTRAINT "sequence_runs_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_runs" ADD CONSTRAINT "sequence_runs_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "sequences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_runs" ADD CONSTRAINT "sequence_runs_current_step_id_fkey" FOREIGN KEY ("current_step_id") REFERENCES "sequence_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sequence_run_id_fkey" FOREIGN KEY ("sequence_run_id") REFERENCES "sequence_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sequence_step_id_fkey" FOREIGN KEY ("sequence_step_id") REFERENCES "sequence_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK constraints (ERD section 7)
ALTER TABLE "accounts" ADD CONSTRAINT "chk_accounts_plan" CHECK ("plan" IN ('starter', 'growth', 'agency'));
ALTER TABLE "accounts" ADD CONSTRAINT "chk_accounts_status" CHECK ("status" IN ('active', 'trial', 'past_due', 'cancelled'));
ALTER TABLE "users" ADD CONSTRAINT "chk_users_role" CHECK ("role" IN ('owner', 'admin', 'viewer'));
ALTER TABLE "businesses" ADD CONSTRAINT "chk_businesses_accounting_provider" CHECK ("accounting_provider" IN ('quickbooks', 'xero', 'freshbooks'));
ALTER TABLE "connections" ADD CONSTRAINT "chk_connections_status" CHECK ("status" IN ('connected', 'expired', 'revoked', 'error'));
ALTER TABLE "invoices" ADD CONSTRAINT "chk_invoices_status" CHECK ("status" IN ('open', 'overdue', 'partial', 'paid', 'voided', 'disputed'));
ALTER TABLE "invoices" ADD CONSTRAINT "chk_invoices_currency" CHECK ("currency" IN ('USD'));
ALTER TABLE "customers" ADD CONSTRAINT "chk_customers_payment_terms" CHECK ("payment_terms" IS NULL OR "payment_terms" IN ('net_30', 'net_60', 'net_90', 'due_on_receipt'));
ALTER TABLE "sequence_steps" ADD CONSTRAINT "chk_sequence_steps_channel" CHECK ("channel" IN ('email', 'sms', 'email_and_sms'));
ALTER TABLE "sequence_runs" ADD CONSTRAINT "chk_sequence_runs_status" CHECK ("status" IN ('active', 'paused', 'completed', 'stopped'));
ALTER TABLE "sequence_runs" ADD CONSTRAINT "chk_sequence_runs_paused_reason" CHECK ("paused_reason" IS NULL OR "paused_reason" IN ('client_replied', 'manual_pause', 'dispute'));
ALTER TABLE "sequence_runs" ADD CONSTRAINT "chk_sequence_runs_stopped_reason" CHECK ("stopped_reason" IS NULL OR "stopped_reason" IN ('payment_received', 'invoice_voided', 'manual_stop'));
ALTER TABLE "messages" ADD CONSTRAINT "chk_messages_channel" CHECK ("channel" IN ('email', 'sms'));
ALTER TABLE "messages" ADD CONSTRAINT "chk_messages_status" CHECK ("status" IN ('queued', 'sent', 'delivered', 'bounced', 'failed'));
