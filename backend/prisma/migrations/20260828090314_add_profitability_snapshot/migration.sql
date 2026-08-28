-- CreateTable
CREATE TABLE "ProfitabilitySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'ALL',
    "projectKey" TEXT NOT NULL DEFAULT 'ALL',
    "asOf" DATETIME NOT NULL,
    "asOfKey" TEXT NOT NULL,
    "grain" TEXT NOT NULL DEFAULT 'MONTH',
    "periodKey" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "plannedRevenue" REAL NOT NULL DEFAULT 0,
    "plannedCost" REAL NOT NULL DEFAULT 0,
    "plannedMargin" REAL NOT NULL DEFAULT 0,
    "cashInPlanned" REAL NOT NULL DEFAULT 0,
    "cashOutPlanned" REAL NOT NULL DEFAULT 0,
    "financingCost" REAL NOT NULL DEFAULT 0,
    "financingBenefit" REAL NOT NULL DEFAULT 0,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfitabilitySnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProfitabilitySnapshot_tenantId_periodKey_idx" ON "ProfitabilitySnapshot"("tenantId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProfitabilitySnapshot_tenantId_scope_projectKey_periodKey_asOfKey_key" ON "ProfitabilitySnapshot"("tenantId", "scope", "projectKey", "periodKey", "asOfKey");
