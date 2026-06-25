-- AlterTable
ALTER TABLE "BoMItem" ADD COLUMN "lineKey" TEXT;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN "bomEvaluation" TEXT;

-- CreateTable
CREATE TABLE "BoMLineQuote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "lineKey" TEXT NOT NULL,
    "componentName" TEXT,
    "vendorId" TEXT,
    "vendorName" TEXT NOT NULL,
    "unitPrice" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "technicalCompliance" TEXT NOT NULL DEFAULT 'COMPLIANT',
    "specSummary" TEXT,
    "deliveryDays" INTEGER,
    "validUntil" DATETIME,
    "notes" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "BoMLineQuote_opportunityId_lineKey_idx" ON "BoMLineQuote"("opportunityId", "lineKey");
