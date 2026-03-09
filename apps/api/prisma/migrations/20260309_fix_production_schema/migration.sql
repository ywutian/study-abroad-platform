-- Safe migration: adds all schema elements that may be missing from production.
-- Every statement uses IF NOT EXISTS / exception handlers to be idempotent.

-- ============================================
-- 1. Enums (for Team feature)
-- ============================================
DO $$ BEGIN CREATE TYPE "TeamVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TeamJoinPolicy" AS ENUM ('OPEN', 'INVITE_ONLY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TeamMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TeamInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ResumeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ResumeType" AS ENUM ('COLLEGE_APPLICATION', 'INTERNSHIP', 'GRADUATE_CV'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ResumeSectionType" AS ENUM ('HEADER', 'EDUCATION', 'TEST_SCORES', 'RESEARCH', 'WORK_EXPERIENCE', 'PROJECTS', 'ACTIVITIES', 'COMMUNITY_SERVICE', 'AWARDS', 'SKILLS', 'PUBLICATIONS', 'TEACHING', 'CERTIFICATIONS', 'CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- 2. User table: add ALL potentially missing columns
-- ============================================
-- Columns from initial db push (no migration file):
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "points" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avgRating" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reviewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Columns from migration 20260214_add_user_referral_and_ban_fields:
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredById" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isBanned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "banReason" TEXT;

-- Column from migration 20260215_add_last_login_at:
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

-- User indexes
CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX IF NOT EXISTS "User_isBanned_idx" ON "User"("isBanned");
CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User"("deletedAt");

-- User self-referral FK
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey"
    FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 3. Review table: add missing columns (if Review table exists)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Review') THEN
    -- Rename essayScore → testScore if old column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Review' AND column_name = 'essayScore') THEN
      ALTER TABLE "Review" RENAME COLUMN "essayScore" TO "testScore";
    END IF;

    -- Add new columns
    EXECUTE 'ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "awardScore" INTEGER NOT NULL DEFAULT 5';
    EXECUTE 'ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "academicComment" TEXT';
    EXECUTE 'ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "testComment" TEXT';
    EXECUTE 'ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "activityComment" TEXT';
    EXECUTE 'ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "awardComment" TEXT';
    EXECUTE 'ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "status" "ReviewStatus" NOT NULL DEFAULT ''PUBLISHED''';
    EXECUTE 'ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[]';
    EXECUTE 'ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "helpfulCount" INTEGER NOT NULL DEFAULT 0';
  END IF;
END $$;

-- ReviewReaction table
CREATE TABLE IF NOT EXISTS "ReviewReaction" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewReaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReviewReaction_reviewId_userId_type_key" ON "ReviewReaction"("reviewId", "userId", "type");
CREATE INDEX IF NOT EXISTS "ReviewReaction_reviewId_idx" ON "ReviewReaction"("reviewId");

DO $$ BEGIN
  ALTER TABLE "ReviewReaction" ADD CONSTRAINT "ReviewReaction_reviewId_fkey"
    FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReviewReaction" ADD CONSTRAINT "ReviewReaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL;
END $$;

-- ============================================
-- 4. Team tables
-- ============================================
CREATE TABLE IF NOT EXISTS "Team" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schoolId" TEXT,
    "tags" JSONB,
    "visibility" "TeamVisibility" NOT NULL,
    "joinPolicy" "TeamJoinPolicy" NOT NULL,
    "maxMembers" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Team_creatorId_idx" ON "Team"("creatorId");
CREATE INDEX IF NOT EXISTS "Team_schoolId_idx" ON "Team"("schoolId");
CREATE INDEX IF NOT EXISTS "Team_visibility_idx" ON "Team"("visibility");
CREATE INDEX IF NOT EXISTS "Team_createdAt_idx" ON "Team"("createdAt");

DO $$ BEGIN
  ALTER TABLE "Team" ADD CONSTRAINT "Team_creatorId_fkey"
    FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Team" ADD CONSTRAINT "Team_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TeamMembership" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamMemberRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeamMembership_teamId_userId_key" ON "TeamMembership"("teamId", "userId");
CREATE INDEX IF NOT EXISTS "TeamMembership_teamId_idx" ON "TeamMembership"("teamId");
CREATE INDEX IF NOT EXISTS "TeamMembership_userId_idx" ON "TeamMembership"("userId");

DO $$ BEGIN
  ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TeamInvitation" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT,
    "token" TEXT,
    "status" "TeamInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeamInvitation_token_key" ON "TeamInvitation"("token");
CREATE INDEX IF NOT EXISTS "TeamInvitation_teamId_idx" ON "TeamInvitation"("teamId");
CREATE INDEX IF NOT EXISTS "TeamInvitation_inviteeId_idx" ON "TeamInvitation"("inviteeId");
CREATE INDEX IF NOT EXISTS "TeamInvitation_token_idx" ON "TeamInvitation"("token");
CREATE INDEX IF NOT EXISTS "TeamInvitation_status_idx" ON "TeamInvitation"("status");

DO $$ BEGIN
  ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_inviterId_fkey"
    FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_inviteeId_fkey"
    FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 5. Resume tables
-- ============================================
CREATE TABLE IF NOT EXISTS "Resume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'My Resume',
    "status" "ResumeStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "ResumeType" NOT NULL DEFAULT 'COLLEGE_APPLICATION',
    "templateId" TEXT NOT NULL DEFAULT 'jake-classic',
    "language" TEXT NOT NULL DEFAULT 'en',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastImportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Resume_userId_idx" ON "Resume"("userId");
CREATE INDEX IF NOT EXISTS "Resume_userId_updatedAt_idx" ON "Resume"("userId", "updatedAt" DESC);

DO $$ BEGIN
  ALTER TABLE "Resume" ADD CONSTRAINT "Resume_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ResumeSection" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "type" "ResumeSectionType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResumeSection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ResumeSection_resumeId_idx" ON "ResumeSection"("resumeId");

DO $$ BEGIN
  ALTER TABLE "ResumeSection" ADD CONSTRAINT "ResumeSection_resumeId_fkey"
    FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ResumeSnapshot" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResumeSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ResumeSnapshot_resumeId_idx" ON "ResumeSnapshot"("resumeId");

DO $$ BEGIN
  ALTER TABLE "ResumeSnapshot" ADD CONSTRAINT "ResumeSnapshot_resumeId_fkey"
    FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ResumeAIReview" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "overallScore" INTEGER,
    "tokenUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResumeAIReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ResumeAIReview_resumeId_idx" ON "ResumeAIReview"("resumeId");

DO $$ BEGIN
  ALTER TABLE "ResumeAIReview" ADD CONSTRAINT "ResumeAIReview_resumeId_fkey"
    FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 6. Payment table (from 20260211_add_payment_model)
-- ============================================
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_orderId_key" ON "Payment"("orderId");
CREATE INDEX IF NOT EXISTS "Payment_userId_idx" ON "Payment"("userId");

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 7. Prediction source columns (from 20260222)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Prediction') THEN
    EXECUTE 'ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT ''manual''';
    EXECUTE 'ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "modelVersion" TEXT';
    EXECUTE 'ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "rawEngineOutputs" JSONB';
  END IF;
END $$;

-- ============================================
-- 8. Message recall (from 20260212_add_message_recall)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Message') THEN
    EXECUTE 'ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "isRecalled" BOOLEAN NOT NULL DEFAULT false';
    EXECUTE 'ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "recalledAt" TIMESTAMP(3)';
  END IF;
END $$;
