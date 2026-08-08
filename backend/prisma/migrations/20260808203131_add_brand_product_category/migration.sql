-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Brand_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BrandSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BrandSource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BrandSource_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "brandId" TEXT,
    "categoryId" TEXT,
    "opportunityId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BoMItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BoMItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BoMItem_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BoMItem" ("createdAt", "currency", "description", "id", "lineKey", "marginPercentage", "opportunityId", "partNumber", "paymentTermDays", "purchaseCost", "quantity", "source", "totalSalePrice", "unitSalePrice", "updatedAt", "vatRate", "vendor") SELECT "createdAt", "currency", "description", "id", "lineKey", "marginPercentage", "opportunityId", "partNumber", "paymentTermDays", "purchaseCost", "quantity", "source", "totalSalePrice", "unitSalePrice", "updatedAt", "vatRate", "vendor" FROM "BoMItem";
DROP TABLE "BoMItem";
ALTER TABLE "new_BoMItem" RENAME TO "BoMItem";
CREATE TABLE "new_DmoCatalogItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "dmoCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandId" TEXT,
    "model" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'ADET',
    "listPrice" REAL NOT NULL DEFAULT 0,
    "vatRate" REAL NOT NULL DEFAULT 20,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "unitCost" REAL NOT NULL DEFAULT 0,
    "costCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "categoryId" TEXT,
    "validFrom" DATETIME,
    "validTo" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "frameworkAgreementId" TEXT,
    "docNumber" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DmoCatalogItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DmoCatalogItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DmoCatalogItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DmoCatalogItem_frameworkAgreementId_fkey" FOREIGN KEY ("frameworkAgreementId") REFERENCES "DmoFrameworkAgreement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DmoCatalogItem" ("costCurrency", "createdAt", "currency", "dmoCode", "docNumber", "frameworkAgreementId", "id", "listPrice", "model", "name", "notes", "status", "tenantId", "unit", "unitCost", "updatedAt", "validFrom", "validTo", "vatRate") SELECT "costCurrency", "createdAt", "currency", "dmoCode", "docNumber", "frameworkAgreementId", "id", "listPrice", "model", "name", "notes", "status", "tenantId", "unit", "unitCost", "updatedAt", "validFrom", "validTo", "vatRate" FROM "DmoCatalogItem";
DROP TABLE "DmoCatalogItem";
ALTER TABLE "new_DmoCatalogItem" RENAME TO "DmoCatalogItem";
CREATE INDEX "DmoCatalogItem_tenantId_status_idx" ON "DmoCatalogItem"("tenantId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Brand_tenantId_name_key" ON "Brand"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_tenantId_name_key" ON "ProductCategory"("tenantId", "name");

