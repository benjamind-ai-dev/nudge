-- AlterTable
ALTER TABLE "accounts" ADD COLUMN "clerk_id" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_clerk_id_key" ON "accounts"("clerk_id");
