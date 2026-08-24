-- CreateIndex
CREATE INDEX "ContractWorkflow_tenantId_status_idx" ON "ContractWorkflow"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Notification_tenantId_userId_idx" ON "Notification"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Opportunity_tenantId_status_idx" ON "Opportunity"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Opportunity_tenantId_assignedToId_idx" ON "Opportunity"("tenantId", "assignedToId");

-- CreateIndex
CREATE INDEX "Project_tenantId_status_idx" ON "Project"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PurchaseRequest_tenantId_status_idx" ON "PurchaseRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TodoTask_tenantId_status_idx" ON "TodoTask"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TodoTask_tenantId_assignedToUserId_idx" ON "TodoTask"("tenantId", "assignedToUserId");
