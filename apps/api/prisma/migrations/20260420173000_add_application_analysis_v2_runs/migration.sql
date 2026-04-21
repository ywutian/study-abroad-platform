-- CreateTable: ApplicationAnalysisRun
CREATE TABLE IF NOT EXISTS "ApplicationAnalysisRun" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "analysisVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "dataQuality" TEXT NOT NULL,
    "debugEnabled" BOOLEAN NOT NULL DEFAULT false,
    "degradedReason" TEXT,
    "inputHash" TEXT NOT NULL,
    "inputSnapshot" JSONB,
    "responsePayload" JSONB,
    "unknowns" JSONB,
    "metrics" JSONB,
    "selectedSchoolIds" TEXT[],
    "targetSchoolCount" INTEGER NOT NULL DEFAULT 0,
    "focusSchoolCount" INTEGER NOT NULL DEFAULT 0,
    "schoolsWithPredictions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApplicationAnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApplicationAnalysisStepRun
CREATE TABLE IF NOT EXISTS "ApplicationAnalysisStepRun" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "model" TEXT,
    "inputHash" TEXT,
    "promptHash" TEXT,
    "normalizedInput" JSONB,
    "normalizedOutput" JSONB,
    "tokenUsage" JSONB,
    "latencyMs" INTEGER,
    "validationErrors" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApplicationAnalysisStepRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApplicationAnalysisSchoolCard
CREATE TABLE IF NOT EXISTS "ApplicationAnalysisSchoolCard" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "tier" TEXT,
    "round" TEXT,
    "evidenceIds" TEXT[],
    "unknowns" TEXT[],
    "policyCard" JSONB,
    "analysisCard" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApplicationAnalysisSchoolCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApplicationAnalysisReplayRun
CREATE TABLE IF NOT EXISTS "ApplicationAnalysisReplayRun" (
    "id" TEXT NOT NULL,
    "analysisVersion" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" JSONB,
    "metrics" JSONB,
    "failures" JSONB,
    "createdBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApplicationAnalysisReplayRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApplicationAnalysisReplayCaseResult
CREATE TABLE IF NOT EXISTS "ApplicationAnalysisReplayCaseResult" (
    "id" TEXT NOT NULL,
    "replayRunId" TEXT NOT NULL,
    "runId" TEXT,
    "caseId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "traceId" TEXT,
    "outputPayload" JSONB,
    "metrics" JSONB,
    "failures" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApplicationAnalysisReplayCaseResult_pkey" PRIMARY KEY ("id")
);

-- AlterTable: ApplicationAnalysisFeedbackRecord
ALTER TABLE "ApplicationAnalysisFeedbackRecord"
ADD COLUMN IF NOT EXISTS "applicationAnalysisRunId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationAnalysisRun_traceId_key" ON "ApplicationAnalysisRun"("traceId");
CREATE INDEX IF NOT EXISTS "ApplicationAnalysisRun_userId_createdAt_idx" ON "ApplicationAnalysisRun"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ApplicationAnalysisRun_profileId_createdAt_idx" ON "ApplicationAnalysisRun"("profileId", "createdAt");
CREATE INDEX IF NOT EXISTS "ApplicationAnalysisRun_analysisVersion_createdAt_idx" ON "ApplicationAnalysisRun"("analysisVersion", "createdAt");
CREATE INDEX IF NOT EXISTS "ApplicationAnalysisRun_status_createdAt_idx" ON "ApplicationAnalysisRun"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "ApplicationAnalysisStepRun_runId_createdAt_idx" ON "ApplicationAnalysisStepRun"("runId", "createdAt");
CREATE INDEX IF NOT EXISTS "ApplicationAnalysisStepRun_stepName_createdAt_idx" ON "ApplicationAnalysisStepRun"("stepName", "createdAt");

CREATE INDEX IF NOT EXISTS "ApplicationAnalysisSchoolCard_runId_schoolId_idx" ON "ApplicationAnalysisSchoolCard"("runId", "schoolId");
CREATE INDEX IF NOT EXISTS "ApplicationAnalysisSchoolCard_schoolId_createdAt_idx" ON "ApplicationAnalysisSchoolCard"("schoolId", "createdAt");

CREATE INDEX IF NOT EXISTS "ApplicationAnalysisReplayRun_analysisVersion_createdAt_idx" ON "ApplicationAnalysisReplayRun"("analysisVersion", "createdAt");
CREATE INDEX IF NOT EXISTS "ApplicationAnalysisReplayRun_dataset_createdAt_idx" ON "ApplicationAnalysisReplayRun"("dataset", "createdAt");
CREATE INDEX IF NOT EXISTS "ApplicationAnalysisReplayRun_status_createdAt_idx" ON "ApplicationAnalysisReplayRun"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "ApplicationAnalysisReplayCaseResult_replayRunId_createdAt_idx" ON "ApplicationAnalysisReplayCaseResult"("replayRunId", "createdAt");
CREATE INDEX IF NOT EXISTS "ApplicationAnalysisReplayCaseResult_caseId_createdAt_idx" ON "ApplicationAnalysisReplayCaseResult"("caseId", "createdAt");
CREATE INDEX IF NOT EXISTS "ApplicationAnalysisReplayCaseResult_runId_createdAt_idx" ON "ApplicationAnalysisReplayCaseResult"("runId", "createdAt");
CREATE INDEX IF NOT EXISTS "ApplicationAnalysisFeedbackRecord_applicationAnalysisRunId__idx" ON "ApplicationAnalysisFeedbackRecord"("applicationAnalysisRunId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ApplicationAnalysisRun"
    ADD CONSTRAINT "ApplicationAnalysisRun_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ApplicationAnalysisStepRun"
    ADD CONSTRAINT "ApplicationAnalysisStepRun_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "ApplicationAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ApplicationAnalysisSchoolCard"
    ADD CONSTRAINT "ApplicationAnalysisSchoolCard_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "ApplicationAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ApplicationAnalysisReplayCaseResult"
    ADD CONSTRAINT "ApplicationAnalysisReplayCaseResult_replayRunId_fkey"
    FOREIGN KEY ("replayRunId") REFERENCES "ApplicationAnalysisReplayRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ApplicationAnalysisReplayCaseResult"
    ADD CONSTRAINT "ApplicationAnalysisReplayCaseResult_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "ApplicationAnalysisRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ApplicationAnalysisFeedbackRecord"
    ADD CONSTRAINT "ApplicationAnalysisFeedbackRecord_applicationAnalysisRunId_fkey"
    FOREIGN KEY ("applicationAnalysisRunId") REFERENCES "ApplicationAnalysisRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
