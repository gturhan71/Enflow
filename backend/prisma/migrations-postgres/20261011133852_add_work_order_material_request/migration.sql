-- CreateTable
CREATE TABLE "WorkOrderMaterialRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "vendorId" TEXT,
    "vendorName" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT,
    "requestedByName" TEXT,
    "approvedByUnitManagerId" TEXT,
    "rejectionNote" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderMaterialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkOrderMaterialRequest_tenantId_workOrderId_idx" ON "WorkOrderMaterialRequest"("tenantId", "workOrderId");

-- AddForeignKey
ALTER TABLE "WorkOrderMaterialRequest" ADD CONSTRAINT "WorkOrderMaterialRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderMaterialRequest" ADD CONSTRAINT "WorkOrderMaterialRequest_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderMaterialRequest" ADD CONSTRAINT "WorkOrderMaterialRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
