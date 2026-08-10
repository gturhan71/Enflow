-- AlterTable
ALTER TABLE "ApprovalStage" ADD COLUMN "dueDate" DATETIME;
ALTER TABLE "ApprovalStage" ADD COLUMN "escalatedAt" DATETIME;
ALTER TABLE "ApprovalStage" ADD COLUMN "escalatedToRole" TEXT;
