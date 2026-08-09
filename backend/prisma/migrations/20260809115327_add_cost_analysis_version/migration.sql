-- CreateTable
CREATE TABLE "CostAnalysisVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "bomItems" TEXT NOT NULL,
    "costItems" TEXT NOT NULL,
    "costConfig" TEXT NOT NULL,
    "grandCost" REAL NOT NULL,
    "offer" REAL NOT NULL,
    "marginPct" REAL NOT NULL,
    "belowFloor" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CostAnalysisVersion_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CostAnalysisVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CostAnalysisVersion_tenantId_opportunityId_version_idx" ON "CostAnalysisVersion"("tenantId", "opportunityId", "version");
