-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BoMItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lineKey" TEXT,
    "partNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "purchaseCost" REAL NOT NULL,
    "marginPercentage" REAL NOT NULL,
    "unitSalePrice" REAL,
    "totalSalePrice" REAL,
    "currency" TEXT,
    "vatRate" REAL NOT NULL DEFAULT 20,
    "source" TEXT,
    "vendor" TEXT,
    "paymentTermDays" INTEGER,
    "opportunityId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BoMItem_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BoMItem" ("createdAt", "currency", "description", "id", "lineKey", "marginPercentage", "opportunityId", "partNumber", "paymentTermDays", "purchaseCost", "quantity", "source", "totalSalePrice", "unitSalePrice", "updatedAt", "vendor") SELECT "createdAt", "currency", "description", "id", "lineKey", "marginPercentage", "opportunityId", "partNumber", "paymentTermDays", "purchaseCost", "quantity", "source", "totalSalePrice", "unitSalePrice", "updatedAt", "vendor" FROM "BoMItem";
DROP TABLE "BoMItem";
ALTER TABLE "new_BoMItem" RENAME TO "BoMItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
