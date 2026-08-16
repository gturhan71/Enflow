-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlatformTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reportedType" TEXT NOT NULL DEFAULT 'BUG',
    "scope" TEXT,
    "category" TEXT,
    "priority" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "targetTimeline" TEXT,
    "resolutionNote" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlatformTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlatformTicket" ("category", "createdAt", "description", "id", "metadata", "priority", "resolutionNote", "scope", "status", "targetTimeline", "tenantId", "title", "updatedAt", "userId", "userName") SELECT "category", "createdAt", "description", "id", "metadata", "priority", "resolutionNote", "scope", "status", "targetTimeline", "tenantId", "title", "updatedAt", "userId", "userName" FROM "PlatformTicket";
DROP TABLE "PlatformTicket";
ALTER TABLE "new_PlatformTicket" RENAME TO "PlatformTicket";
CREATE INDEX "PlatformTicket_tenantId_status_idx" ON "PlatformTicket"("tenantId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
