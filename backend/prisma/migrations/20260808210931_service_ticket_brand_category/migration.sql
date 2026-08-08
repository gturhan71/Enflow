-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ServiceTicket" (
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
    "costAmount" REAL,
    "costCurrency" TEXT,
    "brandId" TEXT,
    "productCategoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServiceTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceTicket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceTicket_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceTicket_productCategoryId_fkey" FOREIGN KEY ("productCategoryId") REFERENCES "ProductCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ServiceTicket" ("assignedToUserId", "category", "costAmount", "costCurrency", "createdAt", "description", "dueAt", "escalatedAt", "id", "priority", "projectId", "reportedAt", "reportedByContactId", "reportedByName", "resolutionNotes", "resolvedAt", "slaHours", "status", "tenantId", "title", "unitId", "updatedAt") SELECT "assignedToUserId", "category", "costAmount", "costCurrency", "createdAt", "description", "dueAt", "escalatedAt", "id", "priority", "projectId", "reportedAt", "reportedByContactId", "reportedByName", "resolutionNotes", "resolvedAt", "slaHours", "status", "tenantId", "title", "unitId", "updatedAt" FROM "ServiceTicket";
DROP TABLE "ServiceTicket";
ALTER TABLE "new_ServiceTicket" RENAME TO "ServiceTicket";
CREATE INDEX "ServiceTicket_tenantId_status_idx" ON "ServiceTicket"("tenantId", "status");
CREATE INDEX "ServiceTicket_tenantId_projectId_idx" ON "ServiceTicket"("tenantId", "projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

