-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "segment" TEXT;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN "forecastCategory" TEXT;

-- AlterTable
ALTER TABLE "WorkflowStep" ADD COLUMN "targetDays" INTEGER;
