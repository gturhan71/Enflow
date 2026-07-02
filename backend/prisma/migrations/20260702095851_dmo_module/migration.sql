-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "dmoOrderId" TEXT;

-- CreateTable
CREATE TABLE "DmoCatalogItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "dmoCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'ADET',
    "listPrice" REAL NOT NULL DEFAULT 0,
    "vatRate" REAL NOT NULL DEFAULT 20,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "unitCost" REAL NOT NULL DEFAULT 0,
    "costCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "category" TEXT,
    "validFrom" DATETIME,
    "validTo" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "frameworkAgreementId" TEXT,
    "docNumber" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DmoCatalogItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DmoCatalogItem_frameworkAgreementId_fkey" FOREIGN KEY ("frameworkAgreementId") REFERENCES "DmoFrameworkAgreement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DmoFrameworkAgreement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "agreementNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "validFrom" DATETIME,
    "validTo" DATETIME,
    "quotaTotal" REAL,
    "quotaUsed" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DmoFrameworkAgreement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DmoExchangeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "validFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" DATETIME,
    "source" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DmoExchangeRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DmoOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryDeadline" DATETIME,
    "frameworkAgreementId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" TEXT NOT NULL DEFAULT 'EVALUATION',
    "ownerId" TEXT,
    "ownerName" TEXT,
    "docNumber" TEXT,
    "notes" TEXT,
    "revenueTotal" REAL NOT NULL DEFAULT 0,
    "costTotal" REAL NOT NULL DEFAULT 0,
    "dmoRateSnapshot" REAL,
    "rateCurrency" TEXT,
    "rateValidFrom" DATETIME,
    "rateValidTo" DATETIME,
    "risturnRateApplied" REAL NOT NULL DEFAULT 0,
    "risturnDeduction" REAL NOT NULL DEFAULT 0,
    "commissionType" TEXT NOT NULL DEFAULT 'PERCENT',
    "commissionValue" REAL NOT NULL DEFAULT 0,
    "commissionBasis" TEXT NOT NULL DEFAULT 'REVENUE',
    "commissionDeduction" REAL NOT NULL DEFAULT 0,
    "grossProfit" REAL NOT NULL DEFAULT 0,
    "netProfit" REAL NOT NULL DEFAULT 0,
    "netMarginPct" REAL NOT NULL DEFAULT 0,
    "isProfitable" BOOLEAN NOT NULL DEFAULT true,
    "alarmReason" TEXT,
    "costedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DmoOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DmoOrder_frameworkAgreementId_fkey" FOREIGN KEY ("frameworkAgreementId") REFERENCES "DmoFrameworkAgreement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DmoOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "name" TEXT NOT NULL,
    "qty" REAL NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "costCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "vatRate" REAL NOT NULL DEFAULT 20,
    "lineRevenue" REAL NOT NULL DEFAULT 0,
    "lineCost" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DmoOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DmoOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DmoCatalogItem_tenantId_status_idx" ON "DmoCatalogItem"("tenantId", "status");

-- CreateIndex
CREATE INDEX "DmoFrameworkAgreement_tenantId_status_idx" ON "DmoFrameworkAgreement"("tenantId", "status");

-- CreateIndex
CREATE INDEX "DmoExchangeRate_tenantId_currency_idx" ON "DmoExchangeRate"("tenantId", "currency");

-- CreateIndex
CREATE INDEX "DmoOrder_tenantId_status_idx" ON "DmoOrder"("tenantId", "status");

-- CreateIndex
CREATE INDEX "DmoOrderItem_orderId_idx" ON "DmoOrderItem"("orderId");
