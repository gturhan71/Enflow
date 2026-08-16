-- CreateTable
CREATE TABLE "PlatformTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
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

-- CreateIndex
CREATE INDEX "PlatformTicket_tenantId_status_idx" ON "PlatformTicket"("tenantId", "status");
