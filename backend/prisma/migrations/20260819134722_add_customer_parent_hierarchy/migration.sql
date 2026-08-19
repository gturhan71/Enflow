-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "industry" TEXT,
    "website" TEXT,
    "logo" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "taxOffice" TEXT,
    "taxNumber" TEXT,
    "chamberOfCommerce" TEXT,
    "tradeRegistryNo" TEXT,
    "source" TEXT,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "creditLimit" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "techStack" TEXT,
    "socialMedia" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "parentId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Customer_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Customer" ("address", "chamberOfCommerce", "city", "country", "createdAt", "creditLimit", "currency", "email", "id", "industry", "logo", "name", "notes", "phone", "postalCode", "riskScore", "shortName", "socialMedia", "source", "status", "taxNumber", "taxOffice", "techStack", "tenantId", "tradeRegistryNo", "updatedAt", "website") SELECT "address", "chamberOfCommerce", "city", "country", "createdAt", "creditLimit", "currency", "email", "id", "industry", "logo", "name", "notes", "phone", "postalCode", "riskScore", "shortName", "socialMedia", "source", "status", "taxNumber", "taxOffice", "techStack", "tenantId", "tradeRegistryNo", "updatedAt", "website" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE INDEX "Customer_tenantId_parentId_idx" ON "Customer"("tenantId", "parentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
