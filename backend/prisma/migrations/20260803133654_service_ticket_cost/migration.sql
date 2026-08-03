-- AlterTable
ALTER TABLE "ProjectCostItem" ADD COLUMN "serviceTicketId" TEXT;

-- AlterTable
ALTER TABLE "ServiceTicket" ADD COLUMN "costAmount" REAL;
ALTER TABLE "ServiceTicket" ADD COLUMN "costCurrency" TEXT;
