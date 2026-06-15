-- Add costConfig to Opportunity (JSON string for persisting cost analysis settings)
ALTER TABLE "Opportunity" ADD COLUMN "costConfig" TEXT;

-- Add computed sale prices and currency to BoMItem
ALTER TABLE "BoMItem" ADD COLUMN "unitSalePrice" REAL;
ALTER TABLE "BoMItem" ADD COLUMN "totalSalePrice" REAL;
ALTER TABLE "BoMItem" ADD COLUMN "currency" TEXT;
ALTER TABLE "BoMItem" ADD COLUMN "source" TEXT;

-- Add currency to CostItem
ALTER TABLE "CostItem" ADD COLUMN "currency" TEXT;
