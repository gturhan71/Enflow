-- CreateTable
CREATE TABLE "PluginEntitlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "pluginKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISABLED',
    "licenseKey" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'ADVISORY',
    "config" TEXT,
    "activatedById" TEXT,
    "activatedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PluginEntitlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "pluginKey" TEXT NOT NULL,
    "unitKey" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'ADVISORY',
    "status" TEXT NOT NULL DEFAULT 'PENDING_RATIFICATION',
    "rationale" TEXT,
    "outputJson" TEXT,
    "triggeredById" TEXT,
    "handoffTaskId" TEXT,
    "ratifiedById" TEXT,
    "ratifiedAt" DATETIME,
    "ratifyNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PluginEntitlement_tenantId_status_idx" ON "PluginEntitlement"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PluginEntitlement_tenantId_pluginKey_key" ON "PluginEntitlement"("tenantId", "pluginKey");

-- CreateIndex
CREATE INDEX "AgentRun_tenantId_status_idx" ON "AgentRun"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AgentRun_tenantId_pluginKey_idx" ON "AgentRun"("tenantId", "pluginKey");
