-- AlterTable
ALTER TABLE "sequence_steps" ADD COLUMN     "template_id" UUID;

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "signature" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_templates" (
    "customer_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_templates_pkey" PRIMARY KEY ("customer_id","template_id")
);

-- CreateIndex
CREATE INDEX "idx_templates_business" ON "templates"("business_id");

-- AddForeignKey
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_templates" ADD CONSTRAINT "customer_templates_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_templates" ADD CONSTRAINT "customer_templates_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing business gets a default "Friendly first reminder" template.
INSERT INTO templates (business_id, name, subject, body, signature, updated_at)
SELECT
  id,
  'Friendly first reminder',
  'Quick note about invoice {{invoice.invoice_number}}',
  E'Hi {{customer.contact_name}},\n\nJust a quick reminder that invoice {{invoice.invoice_number}} for {{invoice.balance_due}} was due on {{invoice.due_date}}. If you''ve already paid, please disregard. Otherwise, you can pay here: {{invoice.payment_link}}\n\nLet me know if you have any questions.',
  E'Thanks,\n{{business.sender_name}}',
  now()
FROM businesses;
