DO $$
BEGIN
    CREATE TYPE "SchoolPolicyDimension" AS ENUM ('TESTING', 'INTL_AID', 'ROUND', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "SchoolPolicyEvidenceStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "ApplicationAnalysisPolicyStatus" AS ENUM ('DRAFT', 'CANDIDATE', 'SHADOW', 'ACTIVE', 'RETIRED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "ApplicationAnalysisEvaluationMode" AS ENUM ('GOLD_SET', 'SHADOW');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "ApplicationAnalysisEvaluationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SchoolPolicyEvidence" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "policyDimension" "SchoolPolicyDimension" NOT NULL,
    "policyValue" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourcePublishedAt" TIMESTAMP(3),
    "sourceQuality" INTEGER,
    "status" "SchoolPolicyEvidenceStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolPolicyEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApplicationAnalysisPolicyVersion" (
    "id" TEXT NOT NULL,
    "policyKey" TEXT NOT NULL DEFAULT 'default',
    "version" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "status" "ApplicationAnalysisPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "analysisVersion" TEXT NOT NULL,
    "promptVersion" TEXT,
    "ruleBundleVersion" TEXT,
    "thresholds" JSONB,
    "rolloutConfig" JSONB,
    "monitoringConfig" JSONB,
    "notes" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "shadowStartedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "activatedBy" TEXT,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationAnalysisPolicyVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApplicationAnalysisEvaluationRun" (
    "id" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "mode" "ApplicationAnalysisEvaluationMode" NOT NULL,
    "status" "ApplicationAnalysisEvaluationStatus" NOT NULL DEFAULT 'PENDING',
    "scopeSummary" JSONB,
    "counts" JSONB,
    "metrics" JSONB,
    "failures" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationAnalysisEvaluationRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationAnalysisPolicyVersion_policyKey_version_key"
ON "ApplicationAnalysisPolicyVersion"("policyKey", "version");

CREATE INDEX IF NOT EXISTS "SchoolPolicyEvidence_schoolId_policyDimension_status_idx"
ON "SchoolPolicyEvidence"("schoolId", "policyDimension", "status");
CREATE INDEX IF NOT EXISTS "SchoolPolicyEvidence_status_updatedAt_idx"
ON "SchoolPolicyEvidence"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "SchoolPolicyEvidence_expiresAt_idx"
ON "SchoolPolicyEvidence"("expiresAt");

CREATE INDEX IF NOT EXISTS "ApplicationAnalysisPolicyVersion_status_activatedAt_idx"
ON "ApplicationAnalysisPolicyVersion"("status", "activatedAt");
CREATE INDEX IF NOT EXISTS "ApplicationAnalysisPolicyVersion_policyKey_status_idx"
ON "ApplicationAnalysisPolicyVersion"("policyKey", "status");

CREATE INDEX IF NOT EXISTS "ApplicationAnalysisEvaluationRun_policyVersionId_mode_creat_idx"
ON "ApplicationAnalysisEvaluationRun"("policyVersionId", "mode", "createdAt");
CREATE INDEX IF NOT EXISTS "ApplicationAnalysisEvaluationRun_status_createdAt_idx"
ON "ApplicationAnalysisEvaluationRun"("status", "createdAt");

DO $$
BEGIN
    ALTER TABLE "SchoolPolicyEvidence"
    ADD CONSTRAINT "SchoolPolicyEvidence_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "ApplicationAnalysisEvaluationRun"
    ADD CONSTRAINT "ApplicationAnalysisEvaluationRun_policyVersionId_fkey"
    FOREIGN KEY ("policyVersionId") REFERENCES "ApplicationAnalysisPolicyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
