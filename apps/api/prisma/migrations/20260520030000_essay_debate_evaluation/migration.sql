-- Essay Debate Evaluation (Phase 2 V1 PR3 — Day 5-7)
--
-- Blind-eval capture table for the Day-6 counsellor validation pass.
-- Each row is one counsellor's rating of one AI turn within an
-- EssayDebateSession. (sessionId, turnIndex, evaluatorId) is the natural
-- composite key — admins running the eval can re-submit the same row
-- with updated rating/notes (the controller does upsert on this tuple).
--
-- Additive only: one new table + one new enum + indexes + one FK back to
-- EssayDebateSession. No ALTER on existing tables, no required NOT NULL
-- columns without defaults — zero-downtime per apps/api/CLAUDE.md.
--
-- Day-7 decision-gate script (scripts/debate-eval-gate.ts) reads these
-- rows to compute κ + evidence-integrity % + lumni-vs-control SHARP+USEFUL
-- share and exits 0/1 per pass/fail.

-- CreateEnum
CREATE TYPE "EssayDebateRating" AS ENUM ('SHARP', 'USEFUL', 'GENERIC', 'SYCOPHANTIC');

-- CreateTable
CREATE TABLE "EssayDebateEvaluation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "turnIndex" INTEGER NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "rating" "EssayDebateRating" NOT NULL,
    "isChatGptControl" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "evidenceIntegrity" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EssayDebateEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EssayDebateEvaluation_sessionId_turnIndex_evaluatorId_key"
    ON "EssayDebateEvaluation"("sessionId", "turnIndex", "evaluatorId");

-- CreateIndex
CREATE INDEX "EssayDebateEvaluation_evaluatorId_idx" ON "EssayDebateEvaluation"("evaluatorId");

-- CreateIndex
CREATE INDEX "EssayDebateEvaluation_rating_idx" ON "EssayDebateEvaluation"("rating");

-- AddForeignKey
ALTER TABLE "EssayDebateEvaluation"
    ADD CONSTRAINT "EssayDebateEvaluation_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "EssayDebateSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
