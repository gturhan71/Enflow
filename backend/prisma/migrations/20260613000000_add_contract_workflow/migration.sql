-- CreateTable: ContractWorkflow
CREATE TABLE "ContractWorkflow" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "title"         TEXT NOT NULL,
    "opportunityId" TEXT,
    "contractId"    TEXT,
    "contractValue" REAL NOT NULL DEFAULT 0,
    "contractText"  TEXT,
    "specText"      TEXT,
    "aiAnalysis"    TEXT,
    "status"        TEXT NOT NULL DEFAULT 'DRAFT',
    "signedDate"    DATETIME,
    "deadline"      DATETIME,
    "notes"         TEXT,
    "tenantId"      TEXT NOT NULL,
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     DATETIME NOT NULL,
    CONSTRAINT "ContractWorkflow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable: ContractWorkflowDoc
CREATE TABLE "ContractWorkflowDoc" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "workflowId"    TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "docType"       TEXT NOT NULL DEFAULT 'OTHER',
    "description"   TEXT,
    "deadline"      DATETIME,
    "status"        TEXT NOT NULL DEFAULT 'PENDING',
    "fileUrl"       TEXT,
    "isRequired"    BOOLEAN NOT NULL DEFAULT 1,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT 0,
    "sortOrder"     INTEGER NOT NULL DEFAULT 0,
    "notes"         TEXT,
    "tenantId"      TEXT NOT NULL,
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     DATETIME NOT NULL,
    CONSTRAINT "ContractWorkflowDoc_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ContractWorkflow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
