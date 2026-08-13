-- AlterTable
ALTER TABLE "ApprovalStage" ADD COLUMN "delegateUserId" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkflowStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "role" TEXT,
    "delegateUserId" TEXT,
    "approvalMode" TEXT NOT NULL DEFAULT 'ANY',
    "actionKey" TEXT,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MANUAL',
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
INSERT INTO "new_WorkflowStep" ("actionKey", "approvalMode", "completionNote", "createdAt", "description", "enabled", "id", "nextStepId", "order", "requiresCompletion", "role", "type", "unitId", "updatedAt", "workflowId") SELECT "actionKey", "approvalMode", "completionNote", "createdAt", "description", "enabled", "id", "nextStepId", "order", "requiresCompletion", "role", "type", "unitId", "updatedAt", "workflowId" FROM "WorkflowStep";
DROP TABLE "WorkflowStep";
ALTER TABLE "new_WorkflowStep" RENAME TO "WorkflowStep";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

