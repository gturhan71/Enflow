-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DailyReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "date" DATETIME NOT NULL,
    "content" TEXT NOT NULL,
    "meetingKind" TEXT NOT NULL DEFAULT 'OTHER',
    "linkType" TEXT NOT NULL DEFAULT 'NEW_CONTACT',
    "linkId" TEXT,
    "linkLabel" TEXT,
    "isKnownToSystem" BOOLEAN NOT NULL DEFAULT false,
    "sharedWithManager" BOOLEAN NOT NULL DEFAULT false,
    "sharedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DailyReport" ("content", "createdAt", "date", "id", "sharedWithManager", "tenantId", "updatedAt", "userId", "userName") SELECT "content", "createdAt", "date", "id", "sharedWithManager", "tenantId", "updatedAt", "userId", "userName" FROM "DailyReport";
DROP TABLE "DailyReport";
ALTER TABLE "new_DailyReport" RENAME TO "DailyReport";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
