-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN "actorName" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "entityLabel" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "summary" TEXT;

-- CreateTable
CREATE TABLE "ActivityLogArchive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
    "targetType" TEXT NOT NULL DEFAULT 'LOCAL',
    "location" TEXT,
    "format" TEXT NOT NULL DEFAULT 'NDJSON',
    "fromTimestamp" DATETIME,
    "toTimestamp" DATETIME,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "checksum" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "pruned" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "ActivityLogArchive_tenantId_status_idx" ON "ActivityLogArchive"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ActivityLogArchive_tenantId_startedAt_idx" ON "ActivityLogArchive"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "ActivityLog_tenantId_timestamp_idx" ON "ActivityLog"("tenantId", "timestamp");
