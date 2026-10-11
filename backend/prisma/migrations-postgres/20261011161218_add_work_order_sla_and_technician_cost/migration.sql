-- AlterTable
ALTER TABLE "User" ADD COLUMN     "costCurrency" TEXT,
ADD COLUMN     "costRate" DOUBLE PRECISION,
ADD COLUMN     "costRateUnit" TEXT;

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "slaHours" INTEGER;
