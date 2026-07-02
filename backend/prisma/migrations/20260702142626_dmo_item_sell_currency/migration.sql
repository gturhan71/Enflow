-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DmoOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "name" TEXT NOT NULL,
    "qty" REAL NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "sellCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "unitCost" REAL NOT NULL DEFAULT 0,
    "costCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "vatRate" REAL NOT NULL DEFAULT 20,
    "lineRevenue" REAL NOT NULL DEFAULT 0,
    "lineCost" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DmoOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DmoOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DmoOrderItem" ("catalogItemId", "costCurrency", "createdAt", "id", "lineCost", "lineRevenue", "name", "orderId", "qty", "unitCost", "unitPrice", "updatedAt", "vatRate") SELECT "catalogItemId", "costCurrency", "createdAt", "id", "lineCost", "lineRevenue", "name", "orderId", "qty", "unitCost", "unitPrice", "updatedAt", "vatRate" FROM "DmoOrderItem";
DROP TABLE "DmoOrderItem";
ALTER TABLE "new_DmoOrderItem" RENAME TO "DmoOrderItem";
CREATE INDEX "DmoOrderItem_orderId_idx" ON "DmoOrderItem"("orderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
