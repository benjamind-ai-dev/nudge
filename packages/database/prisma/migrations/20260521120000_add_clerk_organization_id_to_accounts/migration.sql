-- AlterTable
ALTER TABLE "accounts" ADD COLUMN "clerk_organization_id" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_clerk_organization_id_key" ON "accounts"("clerk_organization_id");
