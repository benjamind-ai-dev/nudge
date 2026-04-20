/*
  Warnings:

  - A unique constraint covering the columns `[business_id,provider]` on the table `connections` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "connections_business_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "idx_connections_business_provider" ON "connections"("business_id", "provider");
