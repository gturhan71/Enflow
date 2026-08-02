-- AlterTable
ALTER TABLE "GuaranteeLetter" ADD COLUMN "remindersSent" TEXT;

-- AlterTable
ALTER TABLE "TodoTask" ADD COLUMN "escalatedAt" DATETIME;
