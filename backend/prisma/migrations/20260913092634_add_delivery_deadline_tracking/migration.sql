/*
  Warnings:

  - You are about to drop the column `segment` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `forecastCategory` on the `Opportunity` table. All the data in the column will be lost.
  - You are about to drop the column `targetDays` on the `WorkflowStep` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ContractWorkflow" ADD COLUMN "deliveryDueDate" DATETIME;
ALTER TABLE "ContractWorkflow" ADD COLUMN "deliveryPeriodDays" INTEGER;
ALTER TABLE "ContractWorkflow" ADD COLUMN "penaltyCapPct" REAL;
ALTER TABLE "ContractWorkflow" ADD COLUMN "penaltyClauseText" TEXT;
ALTER TABLE "ContractWorkflow" ADD COLUMN "penaltyDailyRatePct" REAL;
ALTER TABLE "ContractWorkflow" ADD COLUMN "remindersSent" TEXT;

-- AlterTable
ALTER TABLE "ProjectMilestone" ADD COLUMN "remindersSent" TEXT;

-- CreateTable
CREATE TABLE "DeliveryTimelineStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "tenderId" TEXT,
    "contractWorkflowId" TEXT,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "plannedDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryTimelineStep_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeliveryTimelineStep_contractWorkflowId_fkey" FOREIGN KEY ("contractWorkflowId") REFERENCES "ContractWorkflow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "industry" TEXT,
    "website" TEXT,
    "logo" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "taxOffice" TEXT,
    "taxNumber" TEXT,
    "chamberOfCommerce" TEXT,
    "tradeRegistryNo" TEXT,
    "source" TEXT,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "creditLimit" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "techStack" TEXT,
    "socialMedia" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "parentId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Customer_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Customer" ("address", "chamberOfCommerce", "city", "country", "createdAt", "creditLimit", "currency", "email", "id", "industry", "logo", "name", "notes", "parentId", "phone", "postalCode", "riskScore", "shortName", "socialMedia", "source", "status", "taxNumber", "taxOffice", "techStack", "tenantId", "tradeRegistryNo", "updatedAt", "website") SELECT "address", "chamberOfCommerce", "city", "country", "createdAt", "creditLimit", "currency", "email", "id", "industry", "logo", "name", "notes", "parentId", "phone", "postalCode", "riskScore", "shortName", "socialMedia", "source", "status", "taxNumber", "taxOffice", "techStack", "tenantId", "tradeRegistryNo", "updatedAt", "website" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE INDEX "Customer_tenantId_parentId_idx" ON "Customer"("tenantId", "parentId");
CREATE TABLE "new_Opportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackingCode" TEXT,
    "title" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "probability" INTEGER NOT NULL,
    "expectedCloseDate" DATETIME,
    "status" TEXT NOT NULL,
    "description" TEXT,
    "lostReason" TEXT,
    "agentTriage" TEXT,
    "lastProgressCheckAt" DATETIME,
    "progressRemindersSent" TEXT,
    "procurementMethod" TEXT,
    "targetBidDate" DATETIME,
    "bomEvaluation" TEXT,
    "technicalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "bomStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "costConfig" TEXT,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "presalesId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Opportunity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Opportunity" ("agentTriage", "assignedToId", "bomEvaluation", "bomStatus", "costConfig", "createdAt", "createdById", "currency", "customerId", "description", "expectedCloseDate", "id", "lastProgressCheckAt", "lostReason", "presalesId", "probability", "procurementMethod", "progressRemindersSent", "status", "targetBidDate", "technicalStatus", "tenantId", "title", "trackingCode", "updatedAt", "value") SELECT "agentTriage", "assignedToId", "bomEvaluation", "bomStatus", "costConfig", "createdAt", "createdById", "currency", "customerId", "description", "expectedCloseDate", "id", "lastProgressCheckAt", "lostReason", "presalesId", "probability", "procurementMethod", "progressRemindersSent", "status", "targetBidDate", "technicalStatus", "tenantId", "title", "trackingCode", "updatedAt", "value" FROM "Opportunity";
DROP TABLE "Opportunity";
ALTER TABLE "new_Opportunity" RENAME TO "Opportunity";
CREATE INDEX "Opportunity_tenantId_status_idx" ON "Opportunity"("tenantId", "status");
CREATE INDEX "Opportunity_tenantId_assignedToId_idx" ON "Opportunity"("tenantId", "assignedToId");
CREATE UNIQUE INDEX "Opportunity_tenantId_trackingCode_key" ON "Opportunity"("tenantId", "trackingCode");
CREATE TABLE "new_Tender" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ikn" TEXT,
    "authority" TEXT,
    "method" TEXT NOT NULL DEFAULT 'OPEN',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submissionDeadline" DATETIME,
    "estimatedValue" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "opportunityId" TEXT,
    "contractWorkflowId" TEXT,
    "ekapRef" TEXT,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "docNumber" TEXT,
    "notes" TEXT,
    "specText" TEXT,
    "aiAnalysis" TEXT,
    "remindersSent" TEXT,
    "submittedAt" DATETIME,
    "withdrawnAt" DATETIME,
    "withdrawnById" TEXT,
    "withdrawReason" TEXT,
    "expectedDeliveryDays" INTEGER,
    "vendorDeliveryConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "vendorDeliveryConfirmedNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tender_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Tender" ("aiAnalysis", "authority", "contractWorkflowId", "createdAt", "currency", "docNumber", "ekapRef", "estimatedValue", "id", "ikn", "method", "name", "notes", "opportunityId", "ownerId", "ownerName", "remindersSent", "specText", "status", "submissionDeadline", "submittedAt", "tenantId", "updatedAt", "withdrawReason", "withdrawnAt", "withdrawnById") SELECT "aiAnalysis", "authority", "contractWorkflowId", "createdAt", "currency", "docNumber", "ekapRef", "estimatedValue", "id", "ikn", "method", "name", "notes", "opportunityId", "ownerId", "ownerName", "remindersSent", "specText", "status", "submissionDeadline", "submittedAt", "tenantId", "updatedAt", "withdrawReason", "withdrawnAt", "withdrawnById" FROM "Tender";
DROP TABLE "Tender";
ALTER TABLE "new_Tender" RENAME TO "Tender";
CREATE INDEX "Tender_tenantId_status_idx" ON "Tender"("tenantId", "status");
CREATE TABLE "new_WorkflowStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "role" TEXT,
    "delegateUserId" TEXT,
    "recipientField" TEXT,
    "approvalMode" TEXT NOT NULL DEFAULT 'ANY',
    "actionKey" TEXT,
    "actionConfig" TEXT,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MANUAL',
    "description" TEXT NOT NULL,
    "nextStepId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "requiresCompletion" BOOLEAN NOT NULL DEFAULT false,
    "completionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkflowStep_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WorkflowStep" ("actionConfig", "actionKey", "approvalMode", "completionNote", "createdAt", "delegateUserId", "description", "enabled", "id", "nextStepId", "order", "recipientField", "requiresCompletion", "role", "type", "unitId", "updatedAt", "workflowId") SELECT "actionConfig", "actionKey", "approvalMode", "completionNote", "createdAt", "delegateUserId", "description", "enabled", "id", "nextStepId", "order", "recipientField", "requiresCompletion", "role", "type", "unitId", "updatedAt", "workflowId" FROM "WorkflowStep";
DROP TABLE "WorkflowStep";
ALTER TABLE "new_WorkflowStep" RENAME TO "WorkflowStep";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DeliveryTimelineStep_tenantId_tenderId_idx" ON "DeliveryTimelineStep"("tenantId", "tenderId");

-- CreateIndex
CREATE INDEX "DeliveryTimelineStep_tenantId_contractWorkflowId_idx" ON "DeliveryTimelineStep"("tenantId", "contractWorkflowId");

-- CreateIndex
CREATE INDEX "ContractWorkflow_tenantId_projectId_idx" ON "ContractWorkflow"("tenantId", "projectId");
