-- CreateTable
CREATE TABLE "ServiceTicketAttachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceTicketId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "description" TEXT,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceTicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderAttachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "description" TEXT,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceTicketAttachment_tenantId_serviceTicketId_idx" ON "ServiceTicketAttachment"("tenantId", "serviceTicketId");

-- CreateIndex
CREATE INDEX "WorkOrderAttachment_tenantId_workOrderId_idx" ON "WorkOrderAttachment"("tenantId", "workOrderId");

-- AddForeignKey
ALTER TABLE "ServiceTicketAttachment" ADD CONSTRAINT "ServiceTicketAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTicketAttachment" ADD CONSTRAINT "ServiceTicketAttachment_serviceTicketId_fkey" FOREIGN KEY ("serviceTicketId") REFERENCES "ServiceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderAttachment" ADD CONSTRAINT "WorkOrderAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderAttachment" ADD CONSTRAINT "WorkOrderAttachment_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
