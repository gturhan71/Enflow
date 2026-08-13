-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN "processKey" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ApprovalStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chainId" TEXT NOT NULL,
    "role" TEXT,
    "unitId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'ANY',
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "note" TEXT,
    "approvedAt" DATETIME,
    "agentRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "escalatedAt" DATETIME,
    "escalatedToRole" TEXT,
    CONSTRAINT "ApprovalStage_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "ApprovalChain" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ApprovalStage" ("agentRunId", "approvedAt", "approverId", "chainId", "createdAt", "dueDate", "escalatedAt", "escalatedToRole", "id", "note", "order", "role", "status", "updatedAt") SELECT "agentRunId", "approvedAt", "approverId", "chainId", "createdAt", "dueDate", "escalatedAt", "escalatedToRole", "id", "note", "order", "role", "status", "updatedAt" FROM "ApprovalStage";
DROP TABLE "ApprovalStage";
ALTER TABLE "new_ApprovalStage" RENAME TO "ApprovalStage";
CREATE TABLE "new_WorkflowStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "role" TEXT,
    "approvalMode" TEXT NOT NULL DEFAULT 'ANY',
    "actionKey" TEXT,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'AUTO',
    "description" TEXT NOT NULL,
    "nextStepId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "requiresCompletion" BOOLEAN NOT NULL DEFAULT false,
    "completionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkflowStep_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WorkflowStep" ("completionNote", "createdAt", "description", "enabled", "id", "nextStepId", "order", "requiresCompletion", "type", "unitId", "updatedAt", "workflowId") SELECT "completionNote", "createdAt", "description", "enabled", "id", "nextStepId", "order", "requiresCompletion", "type", "unitId", "updatedAt", "workflowId" FROM "WorkflowStep";
DROP TABLE "WorkflowStep";
ALTER TABLE "new_WorkflowStep" RENAME TO "WorkflowStep";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_tenantId_processKey_key" ON "Workflow"("tenantId", "processKey");

