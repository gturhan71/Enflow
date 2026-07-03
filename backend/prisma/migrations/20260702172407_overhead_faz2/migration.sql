-- CreateTable
CREATE TABLE "ProjectUnitParticipation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "coefficient" REAL NOT NULL DEFAULT 0,
    "role" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectUnitParticipation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectUnitParticipation_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProjectUnitParticipation_projectId_idx" ON "ProjectUnitParticipation"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectUnitParticipation_projectId_unitId_key" ON "ProjectUnitParticipation"("projectId", "unitId");
