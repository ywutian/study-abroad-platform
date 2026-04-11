-- CreateEnum
CREATE TYPE "ApplicationAnalysisFeedbackCategory" AS ENUM (
  'UNSAFE_RECOURSE',
  'POLICY_MISMATCH',
  'MISLEADING_UNCERTAINTY',
  'FAIRNESS_CONCERN',
  'LOW_ACTIONABILITY'
);

-- CreateEnum
CREATE TYPE "ApplicationAnalysisFeedbackSentiment" AS ENUM (
  'HELPFUL',
  'NOT_HELPFUL'
);

-- CreateEnum
CREATE TYPE "ApplicationAnalysisExperimentSweepMode" AS ENUM (
  'HOURLY_ROLLOUT',
  'NIGHTLY_SHADOW',
  'MANUAL_FULL'
);

-- CreateEnum
CREATE TYPE "ApplicationAnalysisExperimentSweepStatus" AS ENUM (
  'RUNNING',
  'COMPLETED',
  'FAILED'
);

-- CreateEnum
CREATE TYPE "ApplicationAnalysisExperimentIncidentSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

-- CreateEnum
CREATE TYPE "ApplicationAnalysisExperimentIncidentStatus" AS ENUM (
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVED'
);

-- CreateTable
CREATE TABLE "ApplicationAnalysisExperimentSweepRun" (
  "id" TEXT NOT NULL,
  "mode" "ApplicationAnalysisExperimentSweepMode" NOT NULL,
  "status" "ApplicationAnalysisExperimentSweepStatus" NOT NULL DEFAULT 'RUNNING',
  "actorId" TEXT,
  "lockKey" TEXT,
  "summary" JSONB,
  "failures" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ApplicationAnalysisExperimentSweepRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationAnalysisExperimentIncident" (
  "id" TEXT NOT NULL,
  "experimentVersionId" TEXT,
  "capability" "ApplicationAnalysisExperimentCapability",
  "type" TEXT NOT NULL,
  "severity" "ApplicationAnalysisExperimentIncidentSeverity" NOT NULL,
  "status" "ApplicationAnalysisExperimentIncidentStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "details" JSONB,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ApplicationAnalysisExperimentIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationAnalysisExposureRecord" (
  "id" TEXT NOT NULL,
  "exposureId" TEXT NOT NULL,
  "experimentVersionId" TEXT NOT NULL,
  "capability" "ApplicationAnalysisExperimentCapability" NOT NULL,
  "userId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "schoolIds" TEXT[],
  "locale" TEXT NOT NULL,
  "exposurePayload" JSONB,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ApplicationAnalysisExposureRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationAnalysisFeedbackRecord" (
  "id" TEXT NOT NULL,
  "exposureRecordId" TEXT NOT NULL,
  "exposureId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "capability" "ApplicationAnalysisExperimentCapability" NOT NULL,
  "schoolId" TEXT,
  "category" "ApplicationAnalysisFeedbackCategory",
  "sentiment" "ApplicationAnalysisFeedbackSentiment" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ApplicationAnalysisFeedbackRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationAnalysisExperimentSweepRun_mode_createdAt_idx"
  ON "ApplicationAnalysisExperimentSweepRun"("mode", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationAnalysisExperimentSweepRun_status_createdAt_idx"
  ON "ApplicationAnalysisExperimentSweepRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationAnalysisExperimentIncident_experimentVersionId_c_idx"
  ON "ApplicationAnalysisExperimentIncident"("experimentVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationAnalysisExperimentIncident_capability_createdAt_idx"
  ON "ApplicationAnalysisExperimentIncident"("capability", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationAnalysisExperimentIncident_status_createdAt_idx"
  ON "ApplicationAnalysisExperimentIncident"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationAnalysisExposureRecord_exposureId_capability_idx"
  ON "ApplicationAnalysisExposureRecord"("exposureId", "capability");

-- CreateIndex
CREATE INDEX "ApplicationAnalysisExposureRecord_experimentVersionId_creat_idx"
  ON "ApplicationAnalysisExposureRecord"("experimentVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationAnalysisExposureRecord_profileId_createdAt_idx"
  ON "ApplicationAnalysisExposureRecord"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationAnalysisFeedbackRecord_exposureRecordId_createdA_idx"
  ON "ApplicationAnalysisFeedbackRecord"("exposureRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationAnalysisFeedbackRecord_exposureId_createdAt_idx"
  ON "ApplicationAnalysisFeedbackRecord"("exposureId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationAnalysisFeedbackRecord_capability_category_creat_idx"
  ON "ApplicationAnalysisFeedbackRecord"("capability", "category", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationAnalysisExposureRecord_userId_createdAt_idx"
  ON "ApplicationAnalysisExposureRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationAnalysisFeedbackRecord_userId_createdAt_idx"
  ON "ApplicationAnalysisFeedbackRecord"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ApplicationAnalysisExperimentIncident"
  ADD CONSTRAINT "ApplicationAnalysisExperimentIncident_experimentVersionId_fkey"
  FOREIGN KEY ("experimentVersionId") REFERENCES "ApplicationAnalysisExperimentVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAnalysisExposureRecord"
  ADD CONSTRAINT "ApplicationAnalysisExposureRecord_experimentVersionId_fkey"
  FOREIGN KEY ("experimentVersionId") REFERENCES "ApplicationAnalysisExperimentVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAnalysisFeedbackRecord"
  ADD CONSTRAINT "ApplicationAnalysisFeedbackRecord_exposureRecordId_fkey"
  FOREIGN KEY ("exposureRecordId") REFERENCES "ApplicationAnalysisExposureRecord"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
