-- AlterTable
ALTER TABLE "User" ADD COLUMN "costCurrency" TEXT;
ALTER TABLE "User" ADD COLUMN "costRate" REAL;
ALTER TABLE "User" ADD COLUMN "costRateUnit" TEXT;

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN "dueAt" DATETIME;
ALTER TABLE "WorkOrder" ADD COLUMN "slaHours" INTEGER;
