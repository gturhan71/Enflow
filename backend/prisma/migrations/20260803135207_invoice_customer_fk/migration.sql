-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "contractId" TEXT,
    "purchaseRequestId" TEXT,
    "dmoOrderId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'SALES',
    "invoiceNo" TEXT,
    "amount" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "issueDate" DATETIME,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "paidAt" DATETIME,
    "milestoneId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "vendorName" TEXT,
    "docNumber" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "issueRateToTRY" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("amount", "contractId", "createdAt", "createdById", "currency", "customerName", "dmoOrderId", "docNumber", "dueDate", "id", "invoiceNo", "issueDate", "issueRateToTRY", "milestoneId", "notes", "paidAmount", "paidAt", "projectId", "purchaseRequestId", "status", "tenantId", "type", "updatedAt", "vendorName") SELECT "amount", "contractId", "createdAt", "createdById", "currency", "customerName", "dmoOrderId", "docNumber", "dueDate", "id", "invoiceNo", "issueDate", "issueRateToTRY", "milestoneId", "notes", "paidAmount", "paidAt", "projectId", "purchaseRequestId", "status", "tenantId", "type", "updatedAt", "vendorName" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_tenantId_status_idx" ON "Invoice"("tenantId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
