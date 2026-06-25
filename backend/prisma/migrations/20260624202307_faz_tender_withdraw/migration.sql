-- AlterTable
ALTER TABLE "Tender" ADD COLUMN "withdrawReason" TEXT;
ALTER TABLE "Tender" ADD COLUMN "withdrawnAt" DATETIME;
ALTER TABLE "Tender" ADD COLUMN "withdrawnById" TEXT;
