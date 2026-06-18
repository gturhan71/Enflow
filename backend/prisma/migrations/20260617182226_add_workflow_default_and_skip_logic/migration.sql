-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Workflow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Workflow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Workflow" ("createdAt", "description", "id", "isActive", "name", "tenantId", "updatedAt") SELECT "createdAt", "description", "id", "isActive", "name", "tenantId", "updatedAt" FROM "Workflow";
DROP TABLE "Workflow";
ALTER TABLE "new_Workflow" RENAME TO "Workflow";
CREATE TABLE "new_WorkflowStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
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
INSERT INTO "new_WorkflowStep" ("createdAt", "description", "id", "nextStepId", "order", "type", "unitId", "updatedAt", "workflowId") SELECT "createdAt", "description", "id", "nextStepId", "order", "type", "unitId", "updatedAt", "workflowId" FROM "WorkflowStep";
DROP TABLE "WorkflowStep";
ALTER TABLE "new_WorkflowStep" RENAME TO "WorkflowStep";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
