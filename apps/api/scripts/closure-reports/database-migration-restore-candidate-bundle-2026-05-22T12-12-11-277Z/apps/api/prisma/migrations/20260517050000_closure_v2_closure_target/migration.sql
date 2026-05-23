-- closure-v2 Continuous Closure Engine — work-queue table.
-- One row per (entity, field) the engine must close; the closure-scheduler
-- walks PENDING rows by priority each tick. Additive only.

-- CreateEnum
CREATE TYPE "ClosureTargetStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'CLOSED', 'UNAVAILABLE', 'FAILED', 'NEEDS_REVIEW');

-- CreateTable
CREATE TABLE "ClosureTarget" (
    "id" TEXT NOT NULL,
    "wave" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "entityName" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "status" "ClosureTargetStatus" NOT NULL DEFAULT 'PENDING',
    "priority" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "batchId" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "sourceUrl" TEXT,
    "confidence" DOUBLE PRECISION,
    "tier" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosureTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClosureTarget_entityType_entityId_field_key" ON "ClosureTarget"("entityType", "entityId", "field");
CREATE INDEX "ClosureTarget_status_priority_idx" ON "ClosureTarget"("status", "priority" DESC);
CREATE INDEX "ClosureTarget_wave_idx" ON "ClosureTarget"("wave");
CREATE INDEX "ClosureTarget_entityType_field_idx" ON "ClosureTarget"("entityType", "field");
CREATE INDEX "ClosureTarget_batchId_idx" ON "ClosureTarget"("batchId");
