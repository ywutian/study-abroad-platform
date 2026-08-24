-- Declarative Agent Skills: immutable versions, pinned runs, evaluations,
-- atomic 100% deployment/rollback, redacted signals and audit evidence.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE "AgentConfigVersion"
  ADD COLUMN IF NOT EXISTS "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "parentVersionId" TEXT,
  ADD COLUMN IF NOT EXISTS "contentHash" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN IF NOT EXISTS "changeReason" TEXT;

ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "skillVersionId" TEXT;
ALTER TABLE "AgentEvaluationTrace" ADD COLUMN IF NOT EXISTS "skillVersionId" TEXT;

CREATE TYPE "AgentSkillEvaluationStage" AS ENUM ('OFFLINE', 'PRODUCTION');
CREATE TYPE "AgentSkillEvaluationStatus" AS ENUM ('RUNNING', 'PASSED', 'FAILED');
CREATE TYPE "AgentSkillDeploymentStatus" AS ENUM ('ACTIVE', 'ROLLED_BACK', 'DISABLED');
CREATE TYPE "AgentSkillSignalStatus" AS ENUM ('PENDING', 'CANDIDATE_CREATED', 'CLOSED', 'PAUSED');

CREATE TABLE "AgentSkillEvaluation" (
  "id" TEXT NOT NULL,
  "agentType" TEXT NOT NULL,
  "baselineVersionId" TEXT NOT NULL,
  "candidateVersionId" TEXT NOT NULL,
  "datasetVersion" TEXT NOT NULL,
  "stage" "AgentSkillEvaluationStage" NOT NULL DEFAULT 'OFFLINE',
  "status" "AgentSkillEvaluationStatus" NOT NULL DEFAULT 'RUNNING',
  "metrics" JSONB NOT NULL,
  "hardFailures" TEXT[] NOT NULL,
  "passed" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentSkillEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentSkillDeployment" (
  "id" TEXT NOT NULL,
  "agentType" TEXT NOT NULL,
  "activeVersionId" TEXT NOT NULL,
  "previousVersionId" TEXT,
  "status" "AgentSkillDeploymentStatus" NOT NULL DEFAULT 'ACTIVE',
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentSkillDeployment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentSkillSignal" (
  "id" TEXT NOT NULL,
  "agentType" TEXT NOT NULL,
  "clusterKey" TEXT NOT NULL,
  "signalType" TEXT NOT NULL,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "payload" JSONB NOT NULL,
  "status" "AgentSkillSignalStatus" NOT NULL DEFAULT 'PENDING',
  "candidateVersionId" TEXT,
  "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentSkillSignal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentSkillAudit" (
  "id" TEXT NOT NULL,
  "agentType" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "versionId" TEXT,
  "actor" TEXT NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentSkillAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentConfigVersion_configType_configKey_contentHash_key"
  ON "AgentConfigVersion"("configType", "configKey", "contentHash");
CREATE INDEX "AgentConfigVersion_configType_configKey_createdAt_idx"
  ON "AgentConfigVersion"("configType", "configKey", "createdAt" DESC);
CREATE INDEX "AgentRun_skillVersionId_idx" ON "AgentRun"("skillVersionId");
CREATE INDEX "AgentEvaluationTrace_skillVersionId_createdAt_idx"
  ON "AgentEvaluationTrace"("skillVersionId", "createdAt");
CREATE INDEX "AgentSkillEvaluation_candidateVersionId_stage_createdAt_idx"
  ON "AgentSkillEvaluation"("candidateVersionId", "stage", "createdAt" DESC);
CREATE INDEX "AgentSkillEvaluation_agentType_status_createdAt_idx"
  ON "AgentSkillEvaluation"("agentType", "status", "createdAt" DESC);
CREATE UNIQUE INDEX "AgentSkillDeployment_agentType_key" ON "AgentSkillDeployment"("agentType");
CREATE INDEX "AgentSkillDeployment_activeVersionId_idx" ON "AgentSkillDeployment"("activeVersionId");
CREATE UNIQUE INDEX "AgentSkillSignal_agentType_clusterKey_key"
  ON "AgentSkillSignal"("agentType", "clusterKey");
CREATE INDEX "AgentSkillSignal_status_occurrenceCount_lastObservedAt_idx"
  ON "AgentSkillSignal"("status", "occurrenceCount", "lastObservedAt");
CREATE INDEX "AgentSkillAudit_agentType_createdAt_idx"
  ON "AgentSkillAudit"("agentType", "createdAt" DESC);
CREATE INDEX "AgentSkillAudit_versionId_idx" ON "AgentSkillAudit"("versionId");

ALTER TABLE "AgentConfigVersion" ADD CONSTRAINT "AgentConfigVersion_parentVersionId_fkey"
  FOREIGN KEY ("parentVersionId") REFERENCES "AgentConfigVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_skillVersionId_fkey"
  FOREIGN KEY ("skillVersionId") REFERENCES "AgentConfigVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentEvaluationTrace" ADD CONSTRAINT "AgentEvaluationTrace_skillVersionId_fkey"
  FOREIGN KEY ("skillVersionId") REFERENCES "AgentConfigVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentSkillEvaluation" ADD CONSTRAINT "AgentSkillEvaluation_baselineVersionId_fkey"
  FOREIGN KEY ("baselineVersionId") REFERENCES "AgentConfigVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentSkillEvaluation" ADD CONSTRAINT "AgentSkillEvaluation_candidateVersionId_fkey"
  FOREIGN KEY ("candidateVersionId") REFERENCES "AgentConfigVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentSkillDeployment" ADD CONSTRAINT "AgentSkillDeployment_activeVersionId_fkey"
  FOREIGN KEY ("activeVersionId") REFERENCES "AgentConfigVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentSkillDeployment" ADD CONSTRAINT "AgentSkillDeployment_previousVersionId_fkey"
  FOREIGN KEY ("previousVersionId") REFERENCES "AgentConfigVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentSkillSignal" ADD CONSTRAINT "AgentSkillSignal_candidateVersionId_fkey"
  FOREIGN KEY ("candidateVersionId") REFERENCES "AgentConfigVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentSkillAudit" ADD CONSTRAINT "AgentSkillAudit_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "AgentConfigVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
