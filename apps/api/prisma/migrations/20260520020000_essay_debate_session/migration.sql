-- Essay Debate (Phase 2 V1 PR1 — Day 1-2)
--
-- Skeleton schema for the "essay debate" feature where users argue back
-- against the existing AI paragraph commentary on gallery essays
-- (AdmissionCase.aiAnalysisCache from PR #253) or AI feedback on their
-- own draft (Essay).
--
-- All additions are purely additive — one new table + one new enum + indexes.
-- No ALTER on existing tables, no NOT NULL columns (zero-downtime per
-- apps/api/CLAUDE.md schema rules).
--
-- Red-team verdict: the response schema explicitly omits `concedes` to
-- prevent the AI from being trained to capitulate (sycophancy 2.0). Turns
-- are stored as a JSON array because the per-user 30/day cap keeps it
-- bounded and turns are always read together.

-- CreateEnum
CREATE TYPE "EssayDebateStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "EssayDebateSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "admissionCaseId" TEXT,
    "essayId" TEXT,
    "paragraphIndex" INTEGER,
    "turns" JSONB NOT NULL DEFAULT '[]',
    "status" "EssayDebateStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalTurns" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EssayDebateSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EssayDebateSession_userId_createdAt_idx" ON "EssayDebateSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EssayDebateSession_admissionCaseId_idx" ON "EssayDebateSession"("admissionCaseId");

-- CreateIndex
CREATE INDEX "EssayDebateSession_essayId_idx" ON "EssayDebateSession"("essayId");

-- AddForeignKey
ALTER TABLE "EssayDebateSession" ADD CONSTRAINT "EssayDebateSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EssayDebateSession" ADD CONSTRAINT "EssayDebateSession_admissionCaseId_fkey" FOREIGN KEY ("admissionCaseId") REFERENCES "AdmissionCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EssayDebateSession" ADD CONSTRAINT "EssayDebateSession_essayId_fkey" FOREIGN KEY ("essayId") REFERENCES "Essay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
