-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CostItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "opportunityId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CostItem_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CostItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CostItem" ("amount", "category", "createdAt", "currency", "description", "id", "opportunityId", "tenantId", "updatedAt") SELECT "amount", "category", "createdAt", "currency", "description", "id", "opportunityId", "tenantId", "updatedAt" FROM "CostItem";
DROP TABLE "CostItem";
ALTER TABLE "new_CostItem" RENAME TO "CostItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
