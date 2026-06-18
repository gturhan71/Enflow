-- CreateTable
CREATE TABLE "UnitReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "unitKey" TEXT NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "periodLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT,
    "authorName" TEXT,
    "metricsSnapshot" TEXT,
    "highlights" TEXT,
    "issues" TEXT,
    "plannedActions" TEXT,
    "risks" TEXT,
    "summary" TEXT,
    "submittedAt" DATETIME,
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    "docNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UnitReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UnitReport_tenantId_unitKey_idx" ON "UnitReport"("tenantId", "unitKey");

-- CreateIndex
CREATE INDEX "UnitReport_tenantId_status_idx" ON "UnitReport"("tenantId", "status");
