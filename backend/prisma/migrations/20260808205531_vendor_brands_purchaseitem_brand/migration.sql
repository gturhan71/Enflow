-- CreateTable
CREATE TABLE "_BrandToVendor" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_BrandToVendor_A_fkey" FOREIGN KEY ("A") REFERENCES "Brand" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_BrandToVendor_B_fkey" FOREIGN KEY ("B") REFERENCES "Vendor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PurchaseItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseRequestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'adet',
    "estimatedUnitPrice" REAL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "actualUnitPrice" REAL,
    "refVendor" TEXT,
    "refSource" TEXT,
    "lineKey" TEXT,
    "brandId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseItem_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseItem" ("actualUnitPrice", "createdAt", "currency", "description", "estimatedUnitPrice", "id", "lineKey", "name", "purchaseRequestId", "quantity", "refSource", "refVendor", "unit") SELECT "actualUnitPrice", "createdAt", "currency", "description", "estimatedUnitPrice", "id", "lineKey", "name", "purchaseRequestId", "quantity", "refSource", "refVendor", "unit" FROM "PurchaseItem";
DROP TABLE "PurchaseItem";
ALTER TABLE "new_PurchaseItem" RENAME TO "PurchaseItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "_BrandToVendor_AB_unique" ON "_BrandToVendor"("A", "B");

-- CreateIndex
CREATE INDEX "_BrandToVendor_B_index" ON "_BrandToVendor"("B");

