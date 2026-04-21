/*
  Warnings:

  - Added the required column `provider` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provider` to the `invoices` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "provider" VARCHAR(50) NOT NULL DEFAULT 'quickbooks';
ALTER TABLE "invoices" ALTER COLUMN "provider" DROP DEFAULT;

ALTER TABLE "customers" ADD COLUMN "provider" VARCHAR(50) NOT NULL DEFAULT 'quickbooks';
ALTER TABLE "customers" ALTER COLUMN "provider" DROP DEFAULT;
