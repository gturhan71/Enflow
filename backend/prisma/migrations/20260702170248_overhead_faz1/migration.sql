-- CreateTable
CREATE TABLE "OperatingCostPool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "personnelCost" REAL NOT NULL DEFAULT 0,
    "otherOpex" REAL NOT NULL DEFAULT 0,
    "totalPool" REAL NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL DEFAULT 'PCT_OF_VALUE',
    "rate" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OperatingCostPool_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UnitBudget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "personnelBudget" REAL NOT NULL DEFAULT 0,
    "opexBudget" REAL NOT NULL DEFAULT 0,
    "totalBudget" REAL NOT NULL DEFAULT 0,
    "periodCost" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UnitBudget_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UnitBudget_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'HARDWARE',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "phase" TEXT NOT NULL DEFAULT 'PLANNING',
    "totalValue" REAL NOT NULL DEFAULT 0,
    "contractCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "budgetTotal" REAL NOT NULL DEFAULT 0,
    "avgMargin" REAL NOT NULL DEFAULT 0,
    "applyOverhead" BOOLEAN NOT NULL DEFAULT false,
    "overheadAmount" REAL NOT NULL DEFAULT 0,
    "netMargin" REAL NOT NULL DEFAULT 0,
    "deadline" DATETIME,
    "plannedEndDate" DATETIME,
    "actualEndDate" DATETIME,
    "startDate" DATETIME,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "customerId" TEXT,
    "customerName" TEXT,
    "ownerId" TEXT,
    "pmId" TEXT,
    "pmName" TEXT,
    "managerId" TEXT,
    "opportunityId" TEXT,
    "contractId" TEXT,
    "procurementNotes" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("actualEndDate", "avgMargin", "budgetTotal", "code", "contractCurrency", "contractId", "createdAt", "customerId", "customerName", "deadline", "description", "id", "managerId", "name", "opportunityId", "ownerId", "phase", "plannedEndDate", "pmId", "pmName", "procurementNotes", "progress", "startDate", "status", "tenantId", "totalValue", "type", "updatedAt") SELECT "actualEndDate", "avgMargin", "budgetTotal", "code", "contractCurrency", "contractId", "createdAt", "customerId", "customerName", "deadline", "description", "id", "managerId", "name", "opportunityId", "ownerId", "phase", "plannedEndDate", "pmId", "pmName", "procurementNotes", "progress", "startDate", "status", "tenantId", "totalValue", "type", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_opportunityId_key" ON "Project"("opportunityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "OperatingCostPool_tenantId_status_idx" ON "OperatingCostPool"("tenantId", "status");

-- CreateIndex
CREATE INDEX "UnitBudget_tenantId_unitId_idx" ON "UnitBudget"("tenantId", "unitId");
