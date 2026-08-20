-- Durable Agent approval lifecycle. Checkpoints contain only workflow control
-- state; private tool outputs remain in the existing conversation message store.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

CREATE TYPE "AgentRunStatus" AS ENUM (
  'RUNNING',
  'WAITING_APPROVAL',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'EXPIRED'
);

CREATE TYPE "AgentApprovalStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'EXECUTING',
  'EXECUTED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'FAILED'
);

CREATE TABLE "AgentRun" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "agentType" TEXT NOT NULL,
  "status" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
  "checkpoint" JSONB,
  "result" JSONB,
  "currentApprovalId" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentApproval" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "toolName" TEXT NOT NULL,
  "arguments" JSONB NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" "AgentApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "decisionReason" TEXT,
  "errorCode" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "decidedAt" TIMESTAMP(3),
  "executionStartedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentApproval_idempotencyKey_key" ON "AgentApproval"("idempotencyKey");
CREATE UNIQUE INDEX "AgentApproval_runId_fingerprint_key" ON "AgentApproval"("runId", "fingerprint");
CREATE INDEX "AgentRun_userId_status_idx" ON "AgentRun"("userId", "status");
CREATE INDEX "AgentRun_conversationId_createdAt_idx" ON "AgentRun"("conversationId", "createdAt" DESC);
CREATE INDEX "AgentRun_status_expiresAt_idx" ON "AgentRun"("status", "expiresAt");
CREATE INDEX "AgentApproval_userId_status_idx" ON "AgentApproval"("userId", "status");
CREATE INDEX "AgentApproval_runId_status_idx" ON "AgentApproval"("runId", "status");
CREATE INDEX "AgentApproval_status_expiresAt_idx" ON "AgentApproval"("status", "expiresAt");

ALTER TABLE "AgentApproval"
ADD CONSTRAINT "AgentApproval_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentRun"
ADD CONSTRAINT "AgentRun_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
