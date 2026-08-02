-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN "rejectionReason" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PurchaseRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceBomId" TEXT,
    "projectId" TEXT,
    "requestedBy" TEXT NOT NULL,
    "requestedByName" TEXT,
    "unitId" TEXT,
    "unitName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "neededBy" DATETIME,
    "budgetAmount" REAL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "budgetAmountTRY" REAL,
    "selectedVendorId" TEXT,
    "selectedVendorName" TEXT,
    "poNumber" TEXT,
    "poIssuedAt" DATETIME,
    "invoiceNo" TEXT,
    "invoiceAmount" REAL,
    "invoiceDate" DATETIME,
    "invoicePaidAt" DATETIME,
    "approvedByUnit" TEXT,
    "approvedByProcurement" TEXT,
    "approvedByGM" TEXT,
    "rejectedBy" TEXT,
    "rejectionNote" TEXT,
    "resubmitCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseRequest" ("approvedByGM", "approvedByProcurement", "approvedByUnit", "budgetAmount", "budgetAmountTRY", "createdAt", "currency", "description", "id", "invoiceAmount", "invoiceDate", "invoiceNo", "invoicePaidAt", "neededBy", "notes", "poIssuedAt", "poNumber", "projectId", "rejectedBy", "rejectionNote", "requestedBy", "requestedByName", "selectedVendorId", "selectedVendorName", "sourceBomId", "sourceType", "status", "tenantId", "title", "unitId", "unitName", "updatedAt", "urgency") SELECT "approvedByGM", "approvedByProcurement", "approvedByUnit", "budgetAmount", "budgetAmountTRY", "createdAt", "currency", "description", "id", "invoiceAmount", "invoiceDate", "invoiceNo", "invoicePaidAt", "neededBy", "notes", "poIssuedAt", "poNumber", "projectId", "rejectedBy", "rejectionNote", "requestedBy", "requestedByName", "selectedVendorId", "selectedVendorName", "sourceBomId", "sourceType", "status", "tenantId", "title", "unitId", "unitName", "updatedAt", "urgency" FROM "PurchaseRequest";
DROP TABLE "PurchaseRequest";
ALTER TABLE "new_PurchaseRequest" RENAME TO "PurchaseRequest";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
