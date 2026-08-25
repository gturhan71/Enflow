-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN "trackingCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_tenantId_trackingCode_key" ON "Opportunity"("tenantId", "trackingCode");
