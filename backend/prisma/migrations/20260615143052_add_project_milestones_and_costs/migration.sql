-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "milestoneType" TEXT NOT NULL DEFAULT 'CUSTOM',
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "assignedToId" TEXT,
    "assignedToName" TEXT,
    "plannedStart" DATETIME,
    "plannedEnd" DATETIME,
    "actualStart" DATETIME,
    "actualEnd" DATETIME,
    "budgetAmount" REAL,
    "actualCost" REAL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "isParallel" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectCostItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "plannedAmount" REAL NOT NULL DEFAULT 0,
    "actualAmount" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "amountTRY" REAL NOT NULL DEFAULT 0,
    "milestoneId" TEXT,
    "purchaseRequestId" TEXT,
    "date" DATETIME,
    "invoiceNo" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectCostItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'HARDWARE',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "phase" TEXT NOT NULL DEFAULT 'PLANNING',
    "totalValue" REAL NOT NULL DEFAULT 0,
    "contractCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "budgetTotal" REAL NOT NULL DEFAULT 0,
    "avgMargin" REAL NOT NULL DEFAULT 0,
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
INSERT INTO "new_Project" ("avgMargin", "createdAt", "customerId", "deadline", "id", "managerId", "name", "opportunityId", "ownerId", "procurementNotes", "progress", "status", "tenantId", "totalValue", "updatedAt") SELECT "avgMargin", "createdAt", "customerId", "deadline", "id", "managerId", "name", "opportunityId", "ownerId", "procurementNotes", "progress", "status", "tenantId", "totalValue", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_opportunityId_key" ON "Project"("opportunityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
