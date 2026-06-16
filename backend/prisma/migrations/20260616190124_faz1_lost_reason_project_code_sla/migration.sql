-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN "lostReason" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "code" TEXT;

-- AlterTable
ALTER TABLE "TodoTask" ADD COLUMN "slaBusinessDays" INTEGER;
