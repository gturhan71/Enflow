-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ContractWorkflowDoc" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "description" TEXT,
    "deadline" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fileUrl" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractWorkflowDoc_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ContractWorkflow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ContractWorkflowDoc" ("createdAt", "deadline", "description", "docType", "fileUrl", "id", "isAiGenerated", "isRequired", "name", "notes", "sortOrder", "status", "tenantId", "updatedAt", "workflowId") SELECT "createdAt", "deadline", "description", "docType", "fileUrl", "id", "isAiGenerated", "isRequired", "name", "notes", "sortOrder", "status", "tenantId", "updatedAt", "workflowId" FROM "ContractWorkflowDoc";
DROP TABLE "ContractWorkflowDoc";
ALTER TABLE "new_ContractWorkflowDoc" RENAME TO "ContractWorkflowDoc";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
