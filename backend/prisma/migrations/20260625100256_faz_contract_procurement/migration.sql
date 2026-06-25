-- AlterTable
ALTER TABLE "ContractWorkflow" ADD COLUMN "procurementRequestId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseItem" ADD COLUMN "refSource" TEXT;
ALTER TABLE "PurchaseItem" ADD COLUMN "refVendor" TEXT;
