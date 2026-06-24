-- AlterTable
ALTER TABLE "Tender" ADD COLUMN "aiAnalysis" TEXT;
ALTER TABLE "Tender" ADD COLUMN "specText" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TenderChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fileUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "docType" TEXT,
    "deadline" DATETIME,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "corporateDocId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TenderChecklistItem_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TenderChecklistItem" ("createdAt", "fileUrl", "id", "isRequired", "name", "notes", "sortOrder", "status", "tenderId", "updatedAt") SELECT "createdAt", "fileUrl", "id", "isRequired", "name", "notes", "sortOrder", "status", "tenderId", "updatedAt" FROM "TenderChecklistItem";
DROP TABLE "TenderChecklistItem";
ALTER TABLE "new_TenderChecklistItem" RENAME TO "TenderChecklistItem";
CREATE INDEX "TenderChecklistItem_tenderId_idx" ON "TenderChecklistItem"("tenderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
