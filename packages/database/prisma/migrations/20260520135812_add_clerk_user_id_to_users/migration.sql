-- AlterTable
ALTER TABLE "users" ADD COLUMN "clerk_user_id" VARCHAR(255);

-- Backfill owner users' clerk_user_id from their account's clerk_id.
UPDATE "users" u
SET "clerk_user_id" = a."clerk_id"
FROM "accounts" a
WHERE u."account_id" = a."id"
  AND u."role" = 'owner'
  AND a."clerk_id" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users"("clerk_user_id");
