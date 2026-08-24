-- CreateTable
CREATE TABLE "SchedulerLock" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "holder" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
