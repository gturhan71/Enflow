-- CreateTable
CREATE TABLE "LegalCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CONTRACT_REVIEW',
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "summary" TEXT,
    "opinion" TEXT,
    "assignedToId" TEXT,
    "assignedToName" TEXT,
    "requestedById" TEXT,
    "requestedByName" TEXT,
    "sourceTaskId" TEXT,
    "dueDate" DATETIME,
    "docNumber" TEXT,
    "fileUrl" TEXT,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LegalCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LegalCase_tenantId_status_idx" ON "LegalCase"("tenantId", "status");
