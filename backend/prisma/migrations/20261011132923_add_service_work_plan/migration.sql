-- CreateTable
CREATE TABLE "ServiceWorkPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "weekOf" DATETIME NOT NULL,
    "unitId" TEXT,
    "preparedById" TEXT NOT NULL,
    "preparedByName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServiceWorkPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceWorkPlan_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "workOrderNo" TEXT,
    "type" TEXT NOT NULL DEFAULT 'INSTALLATION',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT,
    "customerName" TEXT,
    "projectId" TEXT,
    "serviceTicketId" TEXT,
    "unitId" TEXT,
    "requiredSpecialtyId" TEXT,
    "assignedTechnicianId" TEXT,
    "scheduledDate" DATETIME,
    "actualStartAt" DATETIME,
    "actualEndAt" DATETIME,
    "servicePlanId" TEXT,
    "completionNotes" TEXT,
    "customerSignOffAt" DATETIME,
    "customerSignOffName" TEXT,
    "customerSignOffFileUrl" TEXT,
    "costAmount" REAL,
    "costCurrency" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_serviceTicketId_fkey" FOREIGN KEY ("serviceTicketId") REFERENCES "ServiceTicket" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_requiredSpecialtyId_fkey" FOREIGN KEY ("requiredSpecialtyId") REFERENCES "WorkSpecialty" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_servicePlanId_fkey" FOREIGN KEY ("servicePlanId") REFERENCES "ServiceWorkPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WorkOrder" ("actualEndAt", "actualStartAt", "assignedTechnicianId", "completionNotes", "costAmount", "costCurrency", "createdAt", "customerId", "customerName", "customerSignOffAt", "customerSignOffFileUrl", "customerSignOffName", "description", "id", "priority", "projectId", "requiredSpecialtyId", "scheduledDate", "servicePlanId", "serviceTicketId", "status", "tenantId", "title", "type", "unitId", "updatedAt", "workOrderNo") SELECT "actualEndAt", "actualStartAt", "assignedTechnicianId", "completionNotes", "costAmount", "costCurrency", "createdAt", "customerId", "customerName", "customerSignOffAt", "customerSignOffFileUrl", "customerSignOffName", "description", "id", "priority", "projectId", "requiredSpecialtyId", "scheduledDate", "servicePlanId", "serviceTicketId", "status", "tenantId", "title", "type", "unitId", "updatedAt", "workOrderNo" FROM "WorkOrder";
DROP TABLE "WorkOrder";
ALTER TABLE "new_WorkOrder" RENAME TO "WorkOrder";
CREATE INDEX "WorkOrder_tenantId_status_idx" ON "WorkOrder"("tenantId", "status");
CREATE INDEX "WorkOrder_tenantId_assignedTechnicianId_idx" ON "WorkOrder"("tenantId", "assignedTechnicianId");
CREATE INDEX "WorkOrder_tenantId_projectId_idx" ON "WorkOrder"("tenantId", "projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ServiceWorkPlan_tenantId_weekOf_idx" ON "ServiceWorkPlan"("tenantId", "weekOf");
