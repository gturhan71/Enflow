-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
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
    "scheduledDate" TIMESTAMP(3),
    "actualStartAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "servicePlanId" TEXT,
    "completionNotes" TEXT,
    "customerSignOffAt" TIMESTAMP(3),
    "customerSignOffName" TEXT,
    "customerSignOffFileUrl" TEXT,
    "costAmount" DOUBLE PRECISION,
    "costCurrency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSpecialty" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSpecialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWorkSpecialty" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWorkSpecialty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkOrder_tenantId_status_idx" ON "WorkOrder"("tenantId", "status");

-- CreateIndex
CREATE INDEX "WorkOrder_tenantId_assignedTechnicianId_idx" ON "WorkOrder"("tenantId", "assignedTechnicianId");

-- CreateIndex
CREATE INDEX "WorkOrder_tenantId_projectId_idx" ON "WorkOrder"("tenantId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSpecialty_tenantId_name_key" ON "WorkSpecialty"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UserWorkSpecialty_userId_specialtyId_key" ON "UserWorkSpecialty"("userId", "specialtyId");

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_serviceTicketId_fkey" FOREIGN KEY ("serviceTicketId") REFERENCES "ServiceTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_requiredSpecialtyId_fkey" FOREIGN KEY ("requiredSpecialtyId") REFERENCES "WorkSpecialty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSpecialty" ADD CONSTRAINT "WorkSpecialty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWorkSpecialty" ADD CONSTRAINT "UserWorkSpecialty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWorkSpecialty" ADD CONSTRAINT "UserWorkSpecialty_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "WorkSpecialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
