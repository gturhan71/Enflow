-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN "actorType" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "agentRunId" TEXT;

-- AlterTable
ALTER TABLE "ApprovalStage" ADD COLUMN "agentRunId" TEXT;

-- AlterTable
ALTER TABLE "TodoTask" ADD COLUMN "agentRunId" TEXT;
