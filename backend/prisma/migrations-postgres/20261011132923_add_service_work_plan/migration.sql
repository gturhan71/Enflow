-- CreateTable
CREATE TABLE "ServiceWorkPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "weekOf" TIMESTAMP(3) NOT NULL,
    "unitId" TEXT,
    "preparedById" TEXT NOT NULL,
    "preparedByName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceWorkPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceWorkPlan_tenantId_weekOf_idx" ON "ServiceWorkPlan"("tenantId", "weekOf");

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_servicePlanId_fkey" FOREIGN KEY ("servicePlanId") REFERENCES "ServiceWorkPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceWorkPlan" ADD CONSTRAINT "ServiceWorkPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceWorkPlan" ADD CONSTRAINT "ServiceWorkPlan_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
