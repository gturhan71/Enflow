-- AlterTable
ALTER TABLE "BoMItem" ADD COLUMN "paymentTermDays" INTEGER;

-- AlterTable
ALTER TABLE "CostItem" ADD COLUMN "paymentTermDays" INTEGER;

-- CreateTable
CREATE TABLE "CollectionInstallment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "CollectionInstallment_tenantId_opportunityId_idx" ON "CollectionInstallment"("tenantId", "opportunityId");
