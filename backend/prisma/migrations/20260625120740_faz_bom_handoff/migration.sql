-- CreateTable
CREATE TABLE "BomHandoff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "oppTitle" TEXT NOT NULL,
    "customerName" TEXT,
    "handedOffById" TEXT,
    "handedOffByName" TEXT,
    "handoffCount" INTEGER NOT NULL DEFAULT 1,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "totalsByCurrency" TEXT,
    "snapshot" TEXT,
    "firstHandoffAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHandoffAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "BomHandoff_tenantId_lastHandoffAt_idx" ON "BomHandoff"("tenantId", "lastHandoffAt");

-- CreateIndex
CREATE UNIQUE INDEX "BomHandoff_tenantId_opportunityId_key" ON "BomHandoff"("tenantId", "opportunityId");
