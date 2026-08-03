-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "issueRateToTRY" REAL;

-- CreateTable
CREATE TABLE "FxAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountFx" REAL NOT NULL,
    "issueRate" REAL NOT NULL,
    "paymentRate" REAL NOT NULL,
    "gainLossTRY" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FxAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FxAdjustment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FxAdjustment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FxAdjustment_paymentId_key" ON "FxAdjustment"("paymentId");

-- CreateIndex
CREATE INDEX "FxAdjustment_tenantId_invoiceId_idx" ON "FxAdjustment"("tenantId", "invoiceId");
