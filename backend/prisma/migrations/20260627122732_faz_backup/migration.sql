-- CreateTable
CREATE TABLE "BackupJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'PLATFORM',
    "kind" TEXT NOT NULL DEFAULT 'FULL',
    "dbProvider" TEXT NOT NULL DEFAULT 'SQLITE',
    "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
    "targetType" TEXT NOT NULL DEFAULT 'LOCAL',
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "checksum" TEXT,
    "stateRef" TEXT,
    "dataRef" TEXT,
    "modelCounts" TEXT,
    "verifyStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verifyReport" TEXT,
    "verifiedAt" DATETIME,
    "startedById" TEXT,
    "startedByName" TEXT,
    "error" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "RestoreJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "backupId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'LOGICAL',
    "status" TEXT NOT NULL DEFAULT 'ANALYZING',
    "diffReport" TEXT,
    "preRestoreBackupId" TEXT,
    "startedById" TEXT,
    "startedByName" TEXT,
    "error" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "BackupJob_tenantId_status_idx" ON "BackupJob"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BackupJob_tenantId_startedAt_idx" ON "BackupJob"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "RestoreJob_tenantId_status_idx" ON "RestoreJob"("tenantId", "status");

-- CreateIndex
CREATE INDEX "RestoreJob_tenantId_backupId_idx" ON "RestoreJob"("tenantId", "backupId");
