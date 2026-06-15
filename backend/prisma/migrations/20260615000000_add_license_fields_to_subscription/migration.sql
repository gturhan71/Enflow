-- AlterTable: add license fields to Subscription
ALTER TABLE "Subscription" ADD COLUMN "licenseKey" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "licenseModel" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "licenseExpiryDate" DATETIME;
ALTER TABLE "Subscription" ADD COLUMN "licensedUserLimit" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "licensedStorageLimit" INTEGER;
