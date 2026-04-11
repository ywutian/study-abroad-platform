-- CreateEnum
CREATE TYPE "ApplicationAnalysisExperimentCapability" AS ENUM ('RECOURSE', 'UNCERTAINTY', 'FAIRNESS');

-- CreateEnum
CREATE TYPE "ApplicationAnalysisExperimentStatus" AS ENUM ('DRAFT', 'SHADOW', 'CANARY', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ApplicationAnalysisExperimentEvaluationMode" AS ENUM ('GOLD_SET', 'SHADOW', 'CANARY');

-- CreateEnum
CREATE TYPE "ApplicationAnalysisExperimentEvaluationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ApplicationAnalysisExperimentVersion" (
    "id" TEXT NOT NULL,
    "capability" "ApplicationAnalysisExperimentCapability" NOT NULL,
    "version" TEXT NOT NULL,
    "policyVersionId" TEXT,
    "status" "ApplicationAnalysisExperimentStatus" NOT NULL DEFAULT 'DRAFT',
    "methodVersion" TEXT NOT NULL,
    "gateConfig" JSONB,
    "rolloutConfig" JSONB,
    "monitoringConfig" JSONB,
    "notes" TEXT,
    "shadowStartedAt" TIMESTAMP(3),
    "canaryStartedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationAnalysisExperimentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationAnalysisExperimentEvaluationRun" (
    "id" TEXT NOT NULL,
    "experimentVersionId" TEXT NOT NULL,
    "mode" "ApplicationAnalysisExperimentEvaluationMode" NOT NULL,
    "status" "ApplicationAnalysisExperimentEvaluationStatus" NOT NULL DEFAULT 'PENDING',
    "scopeSummary" JSONB,
    "counts" JSONB,
    "metrics" JSONB,
    "failures" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationAnalysisExperimentEvaluationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationAnalysisExperimentVersion_capability_version_key" ON "ApplicationAnalysisExperimentVersion"("capability", "version");

-- CreateIndex
CREATE INDEX "ApplicationAnalysisExperimentVersion_capability_status_idx" ON "ApplicationAnalysisExperimentVersion"("capability", "status");

-- CreateIndex
CREATE INDEX "ApplicationAnalysisExperimentVersion_status_activatedAt_idx" ON "ApplicationAnalysisExperimentVersion"("status", "activatedAt");

-- CreateIndex
CREATE INDEX "ApplicationAnalysisExperimentEvaluationRun_experimentVersionId_mode_createdAt_idx" ON "ApplicationAnalysisExperimentEvaluationRun"("experimentVersionId", "mode", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationAnalysisExperimentEvaluationRun_status_createdAt_idx" ON "ApplicationAnalysisExperimentEvaluationRun"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ApplicationAnalysisExperimentVersion" ADD CONSTRAINT "ApplicationAnalysisExperimentVersion_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "ApplicationAnalysisPolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAnalysisExperimentEvaluationRun" ADD CONSTRAINT "ApplicationAnalysisExperimentEvaluationRun_experimentVersionId_fkey" FOREIGN KEY ("experimentVersionId") REFERENCES "ApplicationAnalysisExperimentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
