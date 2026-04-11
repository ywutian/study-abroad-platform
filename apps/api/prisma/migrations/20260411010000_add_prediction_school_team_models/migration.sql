-- ============================================
-- Enums
-- ============================================

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PredictionOutcomeLabel" AS ENUM ('ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED', 'WITHDRAWN', 'UNKNOWN', 'CENSORED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CompetitionEditionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TeamRecruitmentPhase" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RecruitmentAvailabilityBand" AS ENUM ('LESS_THAN_5_HOURS', 'FIVE_TO_TEN_HOURS', 'TEN_PLUS_HOURS', 'WEEKENDS_ONLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CollaborationMode" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RecruitmentIntentMode" AS ENUM ('TEAM_UP', 'NETWORKING_ONLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TeamRecruitmentSwipeAction" AS ENUM ('LIKE', 'PASS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TeamMatchKind" AS ENUM ('TEAM_UP', 'NETWORKING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ConversationKind" AS ENUM ('DIRECT', 'MATCH_GROUP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PredictionObservationSourceType" AS ENUM ('OFFICIAL_SCHOOL', 'OFFICIAL_FEDERAL', 'TRUSTED_THIRD_PARTY', 'INTERNAL_CASES', 'INTERNAL_OUTCOMES', 'MANUAL_RESEARCH', 'RELATIONSHIP_EVIDENCE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PredictionObservationStatus" AS ENUM ('RAW', 'UNDER_REVIEW', 'APPROVED_FOR_SIGNAL', 'APPROVED_FOR_PRIOR', 'REJECTED', 'EXPIRED', 'SUPERSEDED', 'LICENSE_BLOCKED', 'CONFLICT_FLAGGED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PredictionPolicyStatus" AS ENUM ('DRAFT', 'CANDIDATE', 'SHADOW', 'ACTIVE', 'RETIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PredictionRelationshipType" AS ENUM ('FORMAL_PARTNERSHIP', 'EXCHANGE_PIPELINE', 'SUMMER_PROGRAM_PIPELINE', 'LONG_TERM_FEEDER', 'COUNSELOR_CHANNEL', 'ARTICULATION_OR_MOU', 'OTHER_VERIFIED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PredictionOutcomeLabelStatus" AS ENUM ('SELF_REPORTED', 'COUNSELOR_VERIFIED', 'DOCUMENT_VERIFIED', 'CONFLICTED', 'CENSORED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum: Add RECRUITMENT_CARD to ReportTargetType
DO $$ BEGIN
  ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'RECRUITMENT_CARD';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Tables
-- ============================================

-- CreateTable: CompetitionEdition
CREATE TABLE IF NOT EXISTS "CompetitionEdition" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "seasonLabel" TEXT NOT NULL,
    "status" "CompetitionEditionStatus" NOT NULL DEFAULT 'ACTIVE',
    "registrationOpenAt" TIMESTAMP(3),
    "registrationCloseAt" TIMESTAMP(3),
    "eventStartAt" TIMESTAMP(3),
    "eventEndAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionEdition_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CompetitionTrack
CREATE TABLE IF NOT EXISTS "CompetitionTrack" (
    "id" TEXT NOT NULL,
    "competitionEditionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rolePresets" TEXT[],
    "minTeamSize" INTEGER NOT NULL,
    "maxTeamSize" INTEGER NOT NULL,
    "languages" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SchoolCommunityRating
CREATE TABLE IF NOT EXISTS "SchoolCommunityRating" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "safetyRating" INTEGER NOT NULL,
    "lifeRating" INTEGER NOT NULL,
    "foodRating" INTEGER NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "hiddenAt" TIMESTAMP(3),
    "hiddenBy" TEXT,
    "hiddenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolCommunityRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PredictionPolicyVersion
CREATE TABLE IF NOT EXISTS "PredictionPolicyVersion" (
    "id" TEXT NOT NULL,
    "policyKey" TEXT NOT NULL DEFAULT 'default',
    "version" TEXT NOT NULL,
    "name" TEXT,
    "status" "PredictionPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "priorSetVersion" TEXT,
    "driftSetVersion" TEXT,
    "relationshipSetVersion" TEXT,
    "calibrationVersion" TEXT,
    "numericCoreVersion" TEXT,
    "explanationSchemaVersion" TEXT,
    "thresholds" JSONB,
    "rolloutConfig" JSONB,
    "monitoringConfig" JSONB,
    "fairnessConfig" JSONB,
    "notes" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "activatedBy" TEXT,
    "shadowStartedAt" TIMESTAMP(3),
    "promotedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PredictionSourceObservation
CREATE TABLE IF NOT EXISTS "PredictionSourceObservation" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "schoolId" TEXT,
    "highSchoolId" TEXT,
    "predictionResultId" TEXT,
    "predictionSnapshotId" TEXT,
    "policyVersionId" TEXT,
    "cohortKey" TEXT,
    "round" TEXT,
    "metricType" TEXT NOT NULL,
    "rate" DECIMAL(6,4),
    "admitCount" INTEGER,
    "applyCount" INTEGER,
    "year" INTEGER,
    "sourceType" "PredictionObservationSourceType" NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceVersion" TEXT,
    "sourceUrl" TEXT,
    "license" TEXT,
    "qualityScore" INTEGER,
    "status" "PredictionObservationStatus" NOT NULL DEFAULT 'RAW',
    "observationStage" TEXT NOT NULL DEFAULT 'SERVE',
    "observedProbability" DECIMAL(5,4),
    "observedProbabilityLow" DECIMAL(5,4),
    "observedProbabilityHigh" DECIMAL(5,4),
    "observedWeight" DECIMAL(5,4),
    "confidenceLabel" TEXT,
    "sampleCount" INTEGER,
    "selectivityBand" TEXT,
    "metadata" JSONB,
    "reviewAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveFromCycle" TEXT,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionSourceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SchoolCohortRoundPrior
CREATE TABLE IF NOT EXISTS "SchoolCohortRoundPrior" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "policyVersionId" TEXT,
    "cohortKey" TEXT NOT NULL,
    "round" TEXT NOT NULL,
    "applicationYear" INTEGER,
    "setVersion" TEXT,
    "priorRate" DECIMAL(6,4) NOT NULL,
    "lowerBound" DECIMAL(6,5),
    "upperBound" DECIMAL(6,5),
    "sampleCount" INTEGER,
    "smoothingMethod" TEXT,
    "confidence" TEXT,
    "sourceSummary" JSONB,
    "sourceObservationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "effectiveFromCycle" TEXT,
    "metadata" JSONB,
    "reviewAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "owner" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolCohortRoundPrior_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SchoolCohortRegimeSignal
CREATE TABLE IF NOT EXISTS "SchoolCohortRegimeSignal" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "policyVersionId" TEXT,
    "cohortKey" TEXT,
    "round" TEXT,
    "applicationYear" INTEGER,
    "setVersion" TEXT,
    "regimeKey" TEXT,
    "signalType" TEXT,
    "direction" TEXT,
    "driftMultiplier" DECIMAL(6,4),
    "strength" DECIMAL(6,5),
    "confidence" TEXT,
    "sourceSummary" JSONB,
    "sourceObservationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sampleCount" INTEGER,
    "effectiveFromCycle" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "metadata" JSONB,
    "reviewAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "owner" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolCohortRegimeSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SchoolRelationshipSignal
CREATE TABLE IF NOT EXISTS "SchoolRelationshipSignal" (
    "id" TEXT NOT NULL,
    "sourceHighSchoolId" TEXT,
    "sourceInstitutionName" TEXT,
    "targetSchoolId" TEXT NOT NULL,
    "policyVersionId" TEXT,
    "cohortKey" TEXT,
    "round" TEXT,
    "applicationYear" INTEGER,
    "setVersion" TEXT,
    "relationshipType" "PredictionRelationshipType" NOT NULL,
    "relationshipKey" TEXT,
    "admitRate" DECIMAL(6,5),
    "baselineRate" DECIMAL(6,5),
    "strength" DECIMAL(6,4),
    "signalStrength" DECIMAL(6,5),
    "maxImpactCap" DECIMAL(6,4),
    "sampleCount" INTEGER,
    "confidence" TEXT,
    "sourceSummary" JSONB,
    "sourceObservationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "effectiveFromCycle" TEXT,
    "metadata" JSONB,
    "reviewAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "owner" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolRelationshipSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TeamRecruitmentCard
CREATE TABLE IF NOT EXISTS "TeamRecruitmentCard" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "competitionTrackId" TEXT NOT NULL,
    "phase" "TeamRecruitmentPhase" NOT NULL DEFAULT 'DRAFT',
    "headline" TEXT NOT NULL,
    "detailNote" TEXT,
    "highlightTitle" TEXT,
    "offerRoles" TEXT[],
    "needRoles" TEXT[],
    "skillTags" TEXT[],
    "availabilityBand" "RecruitmentAvailabilityBand",
    "collaborationMode" "CollaborationMode",
    "timezone" TEXT,
    "city" TEXT,
    "languages" TEXT[],
    "intentMode" "RecruitmentIntentMode" NOT NULL DEFAULT 'TEAM_UP',
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamRecruitmentCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TeamRecruitmentMemberProfile
CREATE TABLE IF NOT EXISTS "TeamRecruitmentMemberProfile" (
    "id" TEXT NOT NULL,
    "teamRecruitmentCardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selectedResumeId" TEXT,
    "introLine" TEXT,
    "showSchool" BOOLEAN NOT NULL DEFAULT false,
    "showGrade" BOOLEAN NOT NULL DEFAULT false,
    "showAwards" BOOLEAN NOT NULL DEFAULT false,
    "consentConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamRecruitmentMemberProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TeamRecruitmentSwipe
CREATE TABLE IF NOT EXISTS "TeamRecruitmentSwipe" (
    "id" TEXT NOT NULL,
    "sourceCardId" TEXT NOT NULL,
    "targetCardId" TEXT NOT NULL,
    "actedById" TEXT NOT NULL,
    "action" "TeamRecruitmentSwipeAction" NOT NULL,
    "sourceVersion" INTEGER NOT NULL,
    "targetVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamRecruitmentSwipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TeamMatch
CREATE TABLE IF NOT EXISTS "TeamMatch" (
    "id" TEXT NOT NULL,
    "leftCardId" TEXT NOT NULL,
    "rightCardId" TEXT NOT NULL,
    "matchKind" "TeamMatchKind" NOT NULL,
    "conversationId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PredictionOutcomeLabelRecord
CREATE TABLE IF NOT EXISTS "PredictionOutcomeLabelRecord" (
    "id" TEXT NOT NULL,
    "predictionResultId" TEXT NOT NULL,
    "result" "PredictionOutcomeLabel" NOT NULL,
    "status" "PredictionOutcomeLabelStatus" NOT NULL DEFAULT 'SELF_REPORTED',
    "notes" TEXT,
    "evidenceUrl" TEXT,
    "round" TEXT,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "reportedBy" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionOutcomeLabelRecord_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- AlterTable: Conversation — add new columns
-- ============================================

ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "kind" "ConversationKind" NOT NULL DEFAULT 'DIRECT';
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "createdBySystem" BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- Unique Indexes
-- ============================================

-- CompetitionEdition
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitionEdition_competitionId_seasonLabel_key" ON "CompetitionEdition"("competitionId", "seasonLabel");

-- CompetitionTrack
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitionTrack_competitionEditionId_name_key" ON "CompetitionTrack"("competitionEditionId", "name");

-- SchoolCommunityRating
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolCommunityRating_schoolId_userId_key" ON "SchoolCommunityRating"("schoolId", "userId");

-- PredictionPolicyVersion
CREATE UNIQUE INDEX IF NOT EXISTS "PredictionPolicyVersion_policyKey_version_key" ON "PredictionPolicyVersion"("policyKey", "version");

-- SchoolCohortRoundPrior
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolCohortRoundPrior_schoolId_cohortKey_round_policyVersionI_key" ON "SchoolCohortRoundPrior"("schoolId", "cohortKey", "round", "policyVersionId", "setVersion");

-- SchoolCohortRegimeSignal
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolCohortRegimeSignal_schoolId_cohortKey_round_regimeKey_po_key" ON "SchoolCohortRegimeSignal"("schoolId", "cohortKey", "round", "regimeKey", "policyVersionId", "setVersion");

-- SchoolRelationshipSignal
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolRelationshipSignal_sourceHighSchoolId_targetSchoolId_coh_key" ON "SchoolRelationshipSignal"("sourceHighSchoolId", "targetSchoolId", "cohortKey", "round", "relationshipType", "policyVersionId", "setVersion");

-- TeamRecruitmentCard
CREATE UNIQUE INDEX IF NOT EXISTS "TeamRecruitmentCard_teamId_competitionTrackId_key" ON "TeamRecruitmentCard"("teamId", "competitionTrackId");

-- TeamRecruitmentMemberProfile
CREATE UNIQUE INDEX IF NOT EXISTS "TeamRecruitmentMemberProfile_teamRecruitmentCardId_userId_key" ON "TeamRecruitmentMemberProfile"("teamRecruitmentCardId", "userId");

-- TeamRecruitmentSwipe
CREATE UNIQUE INDEX IF NOT EXISTS "TeamRecruitmentSwipe_sourceCardId_targetCardId_sourceVersion_t_key" ON "TeamRecruitmentSwipe"("sourceCardId", "targetCardId", "sourceVersion", "targetVersion");

-- TeamMatch
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMatch_conversationId_key" ON "TeamMatch"("conversationId");

-- ============================================
-- Regular Indexes
-- ============================================

-- CompetitionEdition
CREATE INDEX IF NOT EXISTS "CompetitionEdition_status_idx" ON "CompetitionEdition"("status");

-- CompetitionTrack
CREATE INDEX IF NOT EXISTS "CompetitionTrack_isActive_idx" ON "CompetitionTrack"("isActive");

-- SchoolCommunityRating
CREATE INDEX IF NOT EXISTS "SchoolCommunityRating_schoolId_isHidden_updatedAt_idx" ON "SchoolCommunityRating"("schoolId", "isHidden", "updatedAt");
CREATE INDEX IF NOT EXISTS "SchoolCommunityRating_userId_updatedAt_idx" ON "SchoolCommunityRating"("userId", "updatedAt");

-- PredictionPolicyVersion
CREATE INDEX IF NOT EXISTS "PredictionPolicyVersion_status_activatedAt_idx" ON "PredictionPolicyVersion"("status", "activatedAt");
CREATE INDEX IF NOT EXISTS "PredictionPolicyVersion_policyKey_status_idx" ON "PredictionPolicyVersion"("policyKey", "status");
CREATE INDEX IF NOT EXISTS "PredictionPolicyVersion_effectiveFrom_promotedAt_idx" ON "PredictionPolicyVersion"("effectiveFrom", "promotedAt");

-- PredictionSourceObservation
CREATE INDEX IF NOT EXISTS "PredictionSourceObservation_predictionResultId_idx" ON "PredictionSourceObservation"("predictionResultId");
CREATE INDEX IF NOT EXISTS "PredictionSourceObservation_predictionSnapshotId_idx" ON "PredictionSourceObservation"("predictionSnapshotId");
CREATE INDEX IF NOT EXISTS "PredictionSourceObservation_profileId_idx" ON "PredictionSourceObservation"("profileId");
CREATE INDEX IF NOT EXISTS "PredictionSourceObservation_status_sourceType_idx" ON "PredictionSourceObservation"("status", "sourceType");
CREATE INDEX IF NOT EXISTS "PredictionSourceObservation_schoolId_cohortKey_round_idx" ON "PredictionSourceObservation"("schoolId", "cohortKey", "round");
CREATE INDEX IF NOT EXISTS "PredictionSourceObservation_schoolId_sourceName_observedAt_idx" ON "PredictionSourceObservation"("schoolId", "sourceName", "observedAt");
CREATE INDEX IF NOT EXISTS "PredictionSourceObservation_highSchoolId_idx" ON "PredictionSourceObservation"("highSchoolId");
CREATE INDEX IF NOT EXISTS "PredictionSourceObservation_policyVersionId_observationStage_idx" ON "PredictionSourceObservation"("policyVersionId", "observationStage");
CREATE INDEX IF NOT EXISTS "PredictionSourceObservation_cohortKey_round_year_idx" ON "PredictionSourceObservation"("cohortKey", "round", "year");

-- SchoolCohortRoundPrior
CREATE INDEX IF NOT EXISTS "SchoolCohortRoundPrior_setVersion_schoolId_cohortKey_round_idx" ON "SchoolCohortRoundPrior"("setVersion", "schoolId", "cohortKey", "round");
CREATE INDEX IF NOT EXISTS "SchoolCohortRoundPrior_policyVersionId_applicationYear_idx" ON "SchoolCohortRoundPrior"("policyVersionId", "applicationYear");

-- SchoolCohortRegimeSignal
CREATE INDEX IF NOT EXISTS "SchoolCohortRegimeSignal_setVersion_schoolId_cohortKey_round_idx" ON "SchoolCohortRegimeSignal"("setVersion", "schoolId", "cohortKey", "round");
CREATE INDEX IF NOT EXISTS "SchoolCohortRegimeSignal_schoolId_regimeKey_idx" ON "SchoolCohortRegimeSignal"("schoolId", "regimeKey");
CREATE INDEX IF NOT EXISTS "SchoolCohortRegimeSignal_cohortKey_round_applicationYear_idx" ON "SchoolCohortRegimeSignal"("cohortKey", "round", "applicationYear");
CREATE INDEX IF NOT EXISTS "SchoolCohortRegimeSignal_policyVersionId_effectiveFrom_idx" ON "SchoolCohortRegimeSignal"("policyVersionId", "effectiveFrom");

-- SchoolRelationshipSignal
CREATE INDEX IF NOT EXISTS "SchoolRelationshipSignal_setVersion_targetSchoolId_cohortKey_r_idx" ON "SchoolRelationshipSignal"("setVersion", "targetSchoolId", "cohortKey", "round");
CREATE INDEX IF NOT EXISTS "SchoolRelationshipSignal_targetSchoolId_relationshipType_idx" ON "SchoolRelationshipSignal"("targetSchoolId", "relationshipType");
CREATE INDEX IF NOT EXISTS "SchoolRelationshipSignal_sourceHighSchoolId_applicationYear_idx" ON "SchoolRelationshipSignal"("sourceHighSchoolId", "applicationYear");
CREATE INDEX IF NOT EXISTS "SchoolRelationshipSignal_policyVersionId_cohortKey_idx" ON "SchoolRelationshipSignal"("policyVersionId", "cohortKey");

-- TeamRecruitmentCard
CREATE INDEX IF NOT EXISTS "TeamRecruitmentCard_phase_isClosed_idx" ON "TeamRecruitmentCard"("phase", "isClosed");
CREATE INDEX IF NOT EXISTS "TeamRecruitmentCard_teamId_updatedAt_idx" ON "TeamRecruitmentCard"("teamId", "updatedAt");

-- TeamRecruitmentMemberProfile
CREATE INDEX IF NOT EXISTS "TeamRecruitmentMemberProfile_userId_idx" ON "TeamRecruitmentMemberProfile"("userId");

-- TeamRecruitmentSwipe
CREATE INDEX IF NOT EXISTS "TeamRecruitmentSwipe_actedById_idx" ON "TeamRecruitmentSwipe"("actedById");
CREATE INDEX IF NOT EXISTS "TeamRecruitmentSwipe_targetCardId_targetVersion_idx" ON "TeamRecruitmentSwipe"("targetCardId", "targetVersion");

-- TeamMatch
CREATE INDEX IF NOT EXISTS "TeamMatch_leftCardId_closedAt_idx" ON "TeamMatch"("leftCardId", "closedAt");
CREATE INDEX IF NOT EXISTS "TeamMatch_rightCardId_closedAt_idx" ON "TeamMatch"("rightCardId", "closedAt");

-- PredictionOutcomeLabelRecord
CREATE INDEX IF NOT EXISTS "PredictionOutcomeLabelRecord_predictionResultId_createdAt_idx" ON "PredictionOutcomeLabelRecord"("predictionResultId", "createdAt");
CREATE INDEX IF NOT EXISTS "PredictionOutcomeLabelRecord_status_idx" ON "PredictionOutcomeLabelRecord"("status");

-- ============================================
-- Foreign Keys
-- ============================================

-- CompetitionEdition
ALTER TABLE "CompetitionEdition" ADD CONSTRAINT "CompetitionEdition_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CompetitionTrack
ALTER TABLE "CompetitionTrack" ADD CONSTRAINT "CompetitionTrack_competitionEditionId_fkey" FOREIGN KEY ("competitionEditionId") REFERENCES "CompetitionEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SchoolCommunityRating
ALTER TABLE "SchoolCommunityRating" ADD CONSTRAINT "SchoolCommunityRating_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolCommunityRating" ADD CONSTRAINT "SchoolCommunityRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PredictionPolicyVersion (no foreign keys — it is referenced by others)

-- PredictionSourceObservation
ALTER TABLE "PredictionSourceObservation" ADD CONSTRAINT "PredictionSourceObservation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PredictionSourceObservation" ADD CONSTRAINT "PredictionSourceObservation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PredictionSourceObservation" ADD CONSTRAINT "PredictionSourceObservation_highSchoolId_fkey" FOREIGN KEY ("highSchoolId") REFERENCES "HighSchool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PredictionSourceObservation" ADD CONSTRAINT "PredictionSourceObservation_predictionResultId_fkey" FOREIGN KEY ("predictionResultId") REFERENCES "PredictionResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PredictionSourceObservation" ADD CONSTRAINT "PredictionSourceObservation_predictionSnapshotId_fkey" FOREIGN KEY ("predictionSnapshotId") REFERENCES "PredictionSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PredictionSourceObservation" ADD CONSTRAINT "PredictionSourceObservation_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PredictionPolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SchoolCohortRoundPrior
ALTER TABLE "SchoolCohortRoundPrior" ADD CONSTRAINT "SchoolCohortRoundPrior_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolCohortRoundPrior" ADD CONSTRAINT "SchoolCohortRoundPrior_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PredictionPolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SchoolCohortRegimeSignal
ALTER TABLE "SchoolCohortRegimeSignal" ADD CONSTRAINT "SchoolCohortRegimeSignal_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolCohortRegimeSignal" ADD CONSTRAINT "SchoolCohortRegimeSignal_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PredictionPolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SchoolRelationshipSignal
ALTER TABLE "SchoolRelationshipSignal" ADD CONSTRAINT "SchoolRelationshipSignal_sourceHighSchoolId_fkey" FOREIGN KEY ("sourceHighSchoolId") REFERENCES "HighSchool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolRelationshipSignal" ADD CONSTRAINT "SchoolRelationshipSignal_targetSchoolId_fkey" FOREIGN KEY ("targetSchoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolRelationshipSignal" ADD CONSTRAINT "SchoolRelationshipSignal_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PredictionPolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TeamRecruitmentCard
ALTER TABLE "TeamRecruitmentCard" ADD CONSTRAINT "TeamRecruitmentCard_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamRecruitmentCard" ADD CONSTRAINT "TeamRecruitmentCard_competitionTrackId_fkey" FOREIGN KEY ("competitionTrackId") REFERENCES "CompetitionTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TeamRecruitmentMemberProfile
ALTER TABLE "TeamRecruitmentMemberProfile" ADD CONSTRAINT "TeamRecruitmentMemberProfile_teamRecruitmentCardId_fkey" FOREIGN KEY ("teamRecruitmentCardId") REFERENCES "TeamRecruitmentCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamRecruitmentMemberProfile" ADD CONSTRAINT "TeamRecruitmentMemberProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamRecruitmentMemberProfile" ADD CONSTRAINT "TeamRecruitmentMemberProfile_selectedResumeId_fkey" FOREIGN KEY ("selectedResumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TeamRecruitmentSwipe
ALTER TABLE "TeamRecruitmentSwipe" ADD CONSTRAINT "TeamRecruitmentSwipe_sourceCardId_fkey" FOREIGN KEY ("sourceCardId") REFERENCES "TeamRecruitmentCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamRecruitmentSwipe" ADD CONSTRAINT "TeamRecruitmentSwipe_targetCardId_fkey" FOREIGN KEY ("targetCardId") REFERENCES "TeamRecruitmentCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamRecruitmentSwipe" ADD CONSTRAINT "TeamRecruitmentSwipe_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TeamMatch
ALTER TABLE "TeamMatch" ADD CONSTRAINT "TeamMatch_leftCardId_fkey" FOREIGN KEY ("leftCardId") REFERENCES "TeamRecruitmentCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMatch" ADD CONSTRAINT "TeamMatch_rightCardId_fkey" FOREIGN KEY ("rightCardId") REFERENCES "TeamRecruitmentCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMatch" ADD CONSTRAINT "TeamMatch_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PredictionOutcomeLabelRecord
ALTER TABLE "PredictionOutcomeLabelRecord" ADD CONSTRAINT "PredictionOutcomeLabelRecord_predictionResultId_fkey" FOREIGN KEY ("predictionResultId") REFERENCES "PredictionResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- AlterTable: Message — add new columns
-- ============================================

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- AlterTable: PredictionResult — add new columns
-- ============================================

ALTER TABLE "PredictionResult" ADD COLUMN IF NOT EXISTS "policyVersionId" TEXT;
ALTER TABLE "PredictionResult" ADD COLUMN IF NOT EXISTS "predictionModelId" TEXT;
ALTER TABLE "PredictionResult" ADD COLUMN IF NOT EXISTS "servedTrace" JSONB;
ALTER TABLE "PredictionResult" ADD COLUMN IF NOT EXISTS "sourceSummary" JSONB;
ALTER TABLE "PredictionResult" ADD COLUMN IF NOT EXISTS "uncertaintyReasons" JSONB;
ALTER TABLE "PredictionResult" ADD COLUMN IF NOT EXISTS "confidenceReason" TEXT;
ALTER TABLE "PredictionResult" ADD COLUMN IF NOT EXISTS "applicationRound" TEXT;
ALTER TABLE "PredictionResult" ADD COLUMN IF NOT EXISTS "applicationYear" INTEGER;
ALTER TABLE "PredictionResult" ADD COLUMN IF NOT EXISTS "cohortKey" TEXT;
ALTER TABLE "PredictionResult" ADD COLUMN IF NOT EXISTS "selectivityBand" TEXT;
ALTER TABLE "PredictionResult" ADD COLUMN IF NOT EXISTS "outcomeLabel" "PredictionOutcomeLabel";
ALTER TABLE "PredictionResult" ADD COLUMN IF NOT EXISTS "outcomeLabeledAt" TIMESTAMP(3);

-- PredictionResult indexes on new columns
CREATE INDEX IF NOT EXISTS "PredictionResult_policyVersionId_idx" ON "PredictionResult"("policyVersionId");
CREATE INDEX IF NOT EXISTS "PredictionResult_predictionModelId_idx" ON "PredictionResult"("predictionModelId");
CREATE INDEX IF NOT EXISTS "PredictionResult_outcomeLabel_idx" ON "PredictionResult"("outcomeLabel");
CREATE INDEX IF NOT EXISTS "PredictionResult_applicationRound_applicationYear_idx" ON "PredictionResult"("applicationRound", "applicationYear");
CREATE INDEX IF NOT EXISTS "PredictionResult_cohortKey_idx" ON "PredictionResult"("cohortKey");

-- PredictionResult foreign keys on new columns
ALTER TABLE "PredictionResult" ADD CONSTRAINT "PredictionResult_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PredictionPolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PredictionResult" ADD CONSTRAINT "PredictionResult_predictionModelId_fkey" FOREIGN KEY ("predictionModelId") REFERENCES "PredictionModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- AlterTable: PredictionSnapshot — add new columns
-- ============================================

ALTER TABLE "PredictionSnapshot" ADD COLUMN IF NOT EXISTS "policyVersionId" TEXT;
ALTER TABLE "PredictionSnapshot" ADD COLUMN IF NOT EXISTS "predictionModelId" TEXT;
ALTER TABLE "PredictionSnapshot" ADD COLUMN IF NOT EXISTS "servedTrace" JSONB;
ALTER TABLE "PredictionSnapshot" ADD COLUMN IF NOT EXISTS "sourceSummary" JSONB;
ALTER TABLE "PredictionSnapshot" ADD COLUMN IF NOT EXISTS "uncertaintyReasons" JSONB;
ALTER TABLE "PredictionSnapshot" ADD COLUMN IF NOT EXISTS "confidenceReason" TEXT;
ALTER TABLE "PredictionSnapshot" ADD COLUMN IF NOT EXISTS "applicationRound" TEXT;
ALTER TABLE "PredictionSnapshot" ADD COLUMN IF NOT EXISTS "applicationYear" INTEGER;
ALTER TABLE "PredictionSnapshot" ADD COLUMN IF NOT EXISTS "cohortKey" TEXT;
ALTER TABLE "PredictionSnapshot" ADD COLUMN IF NOT EXISTS "selectivityBand" TEXT;
ALTER TABLE "PredictionSnapshot" ADD COLUMN IF NOT EXISTS "outcomeLabel" "PredictionOutcomeLabel";
ALTER TABLE "PredictionSnapshot" ADD COLUMN IF NOT EXISTS "outcomeLabeledAt" TIMESTAMP(3);

-- PredictionSnapshot indexes on new columns
CREATE INDEX IF NOT EXISTS "PredictionSnapshot_policyVersionId_idx" ON "PredictionSnapshot"("policyVersionId");
CREATE INDEX IF NOT EXISTS "PredictionSnapshot_predictionModelId_idx" ON "PredictionSnapshot"("predictionModelId");
CREATE INDEX IF NOT EXISTS "PredictionSnapshot_outcomeLabel_idx" ON "PredictionSnapshot"("outcomeLabel");
CREATE INDEX IF NOT EXISTS "PredictionSnapshot_applicationRound_applicationYear_idx" ON "PredictionSnapshot"("applicationRound", "applicationYear");
CREATE INDEX IF NOT EXISTS "PredictionSnapshot_cohortKey_idx" ON "PredictionSnapshot"("cohortKey");

-- PredictionSnapshot foreign keys on new columns
ALTER TABLE "PredictionSnapshot" ADD CONSTRAINT "PredictionSnapshot_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PredictionPolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PredictionSnapshot" ADD CONSTRAINT "PredictionSnapshot_predictionModelId_fkey" FOREIGN KEY ("predictionModelId") REFERENCES "PredictionModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
