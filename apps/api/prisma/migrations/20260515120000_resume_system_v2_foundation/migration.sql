ALTER TYPE "ResumeType" ADD VALUE IF NOT EXISTS 'FULL_TIME_JOB';
ALTER TYPE "ResumeStatus" ADD VALUE IF NOT EXISTS 'REVIEWED';
ALTER TYPE "ResumeStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "ResumeStatus" ADD VALUE IF NOT EXISTS 'EXPORTED';

DO $$ BEGIN CREATE TYPE "ResumeFamily" AS ENUM ('STUDY_ABROAD', 'CAREER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ResumeVariantKind" AS ENUM ('MASTER', 'TAILORED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ResumeTargetType" AS ENUM ('COLLEGE_APPLICATION', 'GRADUATE_PROGRAM', 'INTERNSHIP', 'FULL_TIME_JOB'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ResumeTargetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUBMITTED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ResumeEvidenceKind" AS ENUM ('EDUCATION', 'TEST_SCORE', 'RESEARCH', 'WORK_EXPERIENCE', 'PROJECT', 'ACTIVITY', 'COMMUNITY_SERVICE', 'AWARD', 'SKILL', 'PUBLICATION', 'TEACHING', 'CERTIFICATION', 'CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ResumeEvidenceSource" AS ENUM ('PROFILE', 'RESUME_IMPORT', 'MANUAL', 'AI_GENERATED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ResumePrivacyLevel" AS ENUM ('PRIVATE', 'COUNSELOR_VISIBLE', 'PUBLIC_SHAREABLE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ResumeAIIssueStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DISMISSED', 'APPLIED', 'STALE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ResumeExportFormat" AS ENUM ('PDF', 'DOCX', 'TXT', 'JSON'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ResumeExportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Resume" ADD COLUMN IF NOT EXISTS "targetId" TEXT;
ALTER TABLE "Resume" ADD COLUMN IF NOT EXISTS "baseResumeId" TEXT;
ALTER TABLE "Resume" ADD COLUMN IF NOT EXISTS "family" "ResumeFamily" NOT NULL DEFAULT 'STUDY_ABROAD';
ALTER TABLE "Resume" ADD COLUMN IF NOT EXISTS "variantKind" "ResumeVariantKind" NOT NULL DEFAULT 'MASTER';
ALTER TABLE "Resume" ADD COLUMN IF NOT EXISTS "qualitySummary" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "Resume" ADD COLUMN IF NOT EXISTS "lastReviewAt" TIMESTAMP(3);

ALTER TABLE "ResumeSection" ADD COLUMN IF NOT EXISTS "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ResumeSection" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;
ALTER TABLE "ResumeSection" ADD COLUMN IF NOT EXISTS "evidenceRefs" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "ResumeAIReview" ADD COLUMN IF NOT EXISTS "rubricVersion" TEXT NOT NULL DEFAULT 'resume-v2';
ALTER TABLE "ResumeAIReview" ADD COLUMN IF NOT EXISTS "modelName" TEXT;
ALTER TABLE "ResumeAIReview" ADD COLUMN IF NOT EXISTS "resumeVersion" INTEGER;

CREATE TABLE IF NOT EXISTS "ResumeEvidence" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "ResumeEvidenceKind" NOT NULL,
  "source" "ResumeEvidenceSource" NOT NULL DEFAULT 'MANUAL',
  "title" TEXT NOT NULL,
  "organization" TEXT,
  "role" TEXT,
  "description" TEXT,
  "startDate" TEXT,
  "endDate" TEXT,
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "tags" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "skills" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "metrics" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "proofLinks" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "content" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "confidence" DOUBLE PRECISION,
  "privacyLevel" "ResumePrivacyLevel" NOT NULL DEFAULT 'PRIVATE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResumeEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ResumeTarget" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "ResumeTargetType" NOT NULL,
  "status" "ResumeTargetStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "school" TEXT,
  "program" TEXT,
  "major" TEXT,
  "applicationRound" TEXT,
  "advisorName" TEXT,
  "researchArea" TEXT,
  "labName" TEXT,
  "company" TEXT,
  "role" TEXT,
  "jobDescription" TEXT,
  "deadline" TIMESTAMP(3),
  "keywords" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "requirements" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResumeTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ResumeAIIssue" (
  "id" TEXT NOT NULL,
  "resumeId" TEXT NOT NULL,
  "reviewId" TEXT,
  "sectionId" TEXT,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "status" "ResumeAIIssueStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "original" TEXT,
  "suggestion" TEXT,
  "reason" TEXT,
  "patch" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "confidence" DOUBLE PRECISION,
  "source" TEXT NOT NULL DEFAULT 'AI',
  "baseContentHash" TEXT,
  "appliedAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResumeAIIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ResumeExport" (
  "id" TEXT NOT NULL,
  "resumeId" TEXT NOT NULL,
  "format" "ResumeExportFormat" NOT NULL DEFAULT 'PDF',
  "status" "ResumeExportStatus" NOT NULL DEFAULT 'QUEUED',
  "templateId" TEXT NOT NULL,
  "pageSize" TEXT,
  "pageCount" INTEGER,
  "textExtractable" BOOLEAN,
  "artifactUrl" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "errorMessage" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResumeExport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ResumeComment" (
  "id" TEXT NOT NULL,
  "resumeId" TEXT NOT NULL,
  "sectionId" TEXT,
  "itemId" TEXT,
  "authorId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'STUDENT',
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResumeComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Resume_userId_family_idx" ON "Resume"("userId", "family");
CREATE INDEX IF NOT EXISTS "Resume_targetId_idx" ON "Resume"("targetId");
CREATE INDEX IF NOT EXISTS "Resume_baseResumeId_idx" ON "Resume"("baseResumeId");
CREATE INDEX IF NOT EXISTS "ResumeSection_contentHash_idx" ON "ResumeSection"("contentHash");
CREATE INDEX IF NOT EXISTS "ResumeEvidence_userId_idx" ON "ResumeEvidence"("userId");
CREATE INDEX IF NOT EXISTS "ResumeEvidence_userId_kind_idx" ON "ResumeEvidence"("userId", "kind");
CREATE INDEX IF NOT EXISTS "ResumeEvidence_userId_updatedAt_idx" ON "ResumeEvidence"("userId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "ResumeTarget_userId_idx" ON "ResumeTarget"("userId");
CREATE INDEX IF NOT EXISTS "ResumeTarget_userId_type_idx" ON "ResumeTarget"("userId", "type");
CREATE INDEX IF NOT EXISTS "ResumeTarget_userId_status_idx" ON "ResumeTarget"("userId", "status");
CREATE INDEX IF NOT EXISTS "ResumeAIIssue_resumeId_idx" ON "ResumeAIIssue"("resumeId");
CREATE INDEX IF NOT EXISTS "ResumeAIIssue_reviewId_idx" ON "ResumeAIIssue"("reviewId");
CREATE INDEX IF NOT EXISTS "ResumeAIIssue_resumeId_status_idx" ON "ResumeAIIssue"("resumeId", "status");
CREATE INDEX IF NOT EXISTS "ResumeExport_resumeId_idx" ON "ResumeExport"("resumeId");
CREATE INDEX IF NOT EXISTS "ResumeExport_resumeId_createdAt_idx" ON "ResumeExport"("resumeId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ResumeComment_resumeId_idx" ON "ResumeComment"("resumeId");
CREATE INDEX IF NOT EXISTS "ResumeComment_resumeId_sectionId_idx" ON "ResumeComment"("resumeId", "sectionId");
CREATE INDEX IF NOT EXISTS "ResumeComment_authorId_idx" ON "ResumeComment"("authorId");
CREATE INDEX IF NOT EXISTS "ResumeComment_resumeId_status_idx" ON "ResumeComment"("resumeId", "status");

DO $$ BEGIN ALTER TABLE "Resume" ADD CONSTRAINT "Resume_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "ResumeTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Resume" ADD CONSTRAINT "Resume_baseResumeId_fkey" FOREIGN KEY ("baseResumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ResumeEvidence" ADD CONSTRAINT "ResumeEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ResumeTarget" ADD CONSTRAINT "ResumeTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ResumeAIIssue" ADD CONSTRAINT "ResumeAIIssue_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ResumeAIIssue" ADD CONSTRAINT "ResumeAIIssue_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ResumeAIReview"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ResumeExport" ADD CONSTRAINT "ResumeExport_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ResumeComment" ADD CONSTRAINT "ResumeComment_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ResumeComment" ADD CONSTRAINT "ResumeComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
