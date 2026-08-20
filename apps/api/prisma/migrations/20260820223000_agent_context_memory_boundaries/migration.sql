-- Phase 3 Agent Harness: immutable run budgets, structured context checkpoints,
-- and redacted evaluation evidence. Existing nullable columns preserve rollback compatibility.
ALTER TABLE "AgentRun"
  ADD COLUMN "budget" JSONB,
  ADD COLUMN "usage" JSONB,
  ADD COLUMN "contextSummary" JSONB;

CREATE TABLE "AgentEvaluationTrace" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "traceVersion" INTEGER NOT NULL DEFAULT 1,
  "agentType" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "redactedTypes" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AgentEvaluationTrace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentEvaluationTrace_runId_key"
  ON "AgentEvaluationTrace"("runId");
CREATE INDEX "AgentEvaluationTrace_agentType_outcome_idx"
  ON "AgentEvaluationTrace"("agentType", "outcome");
CREATE INDEX "AgentEvaluationTrace_createdAt_idx"
  ON "AgentEvaluationTrace"("createdAt");

ALTER TABLE "AgentEvaluationTrace"
  ADD CONSTRAINT "AgentEvaluationTrace_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "AgentRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
