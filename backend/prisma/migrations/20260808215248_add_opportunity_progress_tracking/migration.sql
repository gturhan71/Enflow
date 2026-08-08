-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN "lastProgressCheckAt" DATETIME;
ALTER TABLE "Opportunity" ADD COLUMN "progressRemindersSent" TEXT;

-- CreateTable
CREATE TABLE "OpportunityProgressLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "previousProbability" INTEGER NOT NULL,
    "newProbability" INTEGER NOT NULL,
    "changed" BOOLEAN NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpportunityProgressLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OpportunityProgressLog_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OpportunityProgressLog_tenantId_opportunityId_createdAt_idx" ON "OpportunityProgressLog"("tenantId", "opportunityId", "createdAt");
