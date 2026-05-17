-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TodoTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "unitId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueDate" DATETIME,
    "progressNotes" TEXT,
    "relatedModule" TEXT,
    "relatedItemId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TodoTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TodoTask" ("assignedBy", "createdAt", "description", "dueDate", "id", "priority", "progressNotes", "relatedItemId", "relatedModule", "status", "tenantId", "title", "unitId", "updatedAt") SELECT "assignedBy", "createdAt", "description", "dueDate", "id", "priority", "progressNotes", "relatedItemId", "relatedModule", "status", "tenantId", "title", "unitId", "updatedAt" FROM "TodoTask";
DROP TABLE "TodoTask";
ALTER TABLE "new_TodoTask" RENAME TO "TodoTask";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
