-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GuaranteeLetter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "contractId" TEXT,
    "tenderId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'PERFORMANCE',
    "bankName" TEXT,
    "amount" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "issueDate" DATETIME,
    "expiryDate" DATETIME,
    "isIndefinite" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "refNo" TEXT,
    "docNumber" TEXT,
    "fileUrl" TEXT,
    "notes" TEXT,
    "requestedById" TEXT,
    "requestNote" TEXT,
    "sampleText" TEXT,
    "sampleFileUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GuaranteeLetter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GuaranteeLetter" ("amount", "bankName", "contractId", "createdAt", "currency", "docNumber", "expiryDate", "fileUrl", "id", "issueDate", "notes", "projectId", "refNo", "status", "tenantId", "tenderId", "type", "updatedAt") SELECT "amount", "bankName", "contractId", "createdAt", "currency", "docNumber", "expiryDate", "fileUrl", "id", "issueDate", "notes", "projectId", "refNo", "status", "tenantId", "tenderId", "type", "updatedAt" FROM "GuaranteeLetter";
DROP TABLE "GuaranteeLetter";
ALTER TABLE "new_GuaranteeLetter" RENAME TO "GuaranteeLetter";
CREATE INDEX "GuaranteeLetter_tenantId_status_idx" ON "GuaranteeLetter"("tenantId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
