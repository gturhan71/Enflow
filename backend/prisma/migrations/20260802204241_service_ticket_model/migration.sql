-- CreateTable
CREATE TABLE "ServiceTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'FAULT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedByContactId" TEXT,
    "reportedByName" TEXT,
    "assignedToUserId" TEXT,
    "unitId" TEXT,
    "slaHours" INTEGER,
    "dueAt" DATETIME,
    "escalatedAt" DATETIME,
    "resolvedAt" DATETIME,
    "resolutionNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServiceTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceTicket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ServiceTicket_tenantId_status_idx" ON "ServiceTicket"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ServiceTicket_tenantId_projectId_idx" ON "ServiceTicket"("tenantId", "projectId");
