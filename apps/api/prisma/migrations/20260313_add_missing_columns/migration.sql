-- Add missing columns to existing tables.
-- The 20260312 migration used CREATE TABLE IF NOT EXISTS, which skips tables
-- that already exist. This migration adds columns that were added to the schema
-- after the initial db:push but never had migration files.

-- ============================================
-- 1. Profile — 6 columns added after initial push
-- ============================================
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "intendedMajor" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "secondMajor" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "countryOfResidence" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "citizenship" TEXT;
DO $$ BEGIN
  ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "educationSystem" "EducationSystem";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "recommendationPreferences" JSONB;

-- ============================================
-- 2. AdmissionCase — essay/GPA fields added later
-- ============================================
ALTER TABLE "AdmissionCase" ADD COLUMN IF NOT EXISTS "gpa9" DOUBLE PRECISION;
ALTER TABLE "AdmissionCase" ADD COLUMN IF NOT EXISTS "gpa10" DOUBLE PRECISION;
ALTER TABLE "AdmissionCase" ADD COLUMN IF NOT EXISTS "gpa11" DOUBLE PRECISION;
ALTER TABLE "AdmissionCase" ADD COLUMN IF NOT EXISTS "gpa12" DOUBLE PRECISION;
ALTER TABLE "AdmissionCase" ADD COLUMN IF NOT EXISTS "ucCappedGpa" DOUBLE PRECISION;
ALTER TABLE "AdmissionCase" ADD COLUMN IF NOT EXISTS "ucUncappedGpa" DOUBLE PRECISION;
ALTER TABLE "AdmissionCase" ADD COLUMN IF NOT EXISTS "gpaScale" DOUBLE PRECISION;
ALTER TABLE "AdmissionCase" ADD COLUMN IF NOT EXISTS "activityList" TEXT;
DO $$ BEGIN
  ALTER TABLE "AdmissionCase" ADD COLUMN IF NOT EXISTS "essayType" "EssayType";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
ALTER TABLE "AdmissionCase" ADD COLUMN IF NOT EXISTS "essayPrompt" TEXT;
ALTER TABLE "AdmissionCase" ADD COLUMN IF NOT EXISTS "essayContent" TEXT;
ALTER TABLE "AdmissionCase" ADD COLUMN IF NOT EXISTS "promptNumber" INTEGER;

-- ============================================
-- 3. School — Niche grade fields
-- ============================================
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "nicheSafetyGrade" TEXT;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "nicheLifeGrade" TEXT;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "nicheFoodGrade" TEXT;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "nicheOverallGrade" TEXT;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "needBlindInternational" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "intlStudentPct" DECIMAL(5,2);
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "intlAcceptanceRate" DECIMAL(5,2);

-- ============================================
-- 4. ForumPost — Team post fields
-- ============================================
ALTER TABLE "ForumPost" ADD COLUMN IF NOT EXISTS "isTeamPost" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ForumPost" ADD COLUMN IF NOT EXISTS "teamSize" INTEGER;
ALTER TABLE "ForumPost" ADD COLUMN IF NOT EXISTS "currentSize" INTEGER DEFAULT 1;
ALTER TABLE "ForumPost" ADD COLUMN IF NOT EXISTS "requirements" TEXT;
ALTER TABLE "ForumPost" ADD COLUMN IF NOT EXISTS "teamDeadline" TIMESTAMP(3);
DO $$ BEGIN
  ALTER TABLE "ForumPost" ADD COLUMN IF NOT EXISTS "teamStatus" "TeamStatus" NOT NULL DEFAULT 'RECRUITING';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ForumPost" ADD COLUMN IF NOT EXISTS "postTag" "ForumPostTag";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ForumPost indexes for new columns
CREATE INDEX IF NOT EXISTS "ForumPost_isTeamPost_idx" ON "ForumPost"("isTeamPost");
CREATE INDEX IF NOT EXISTS "ForumPost_postTag_idx" ON "ForumPost"("postTag");

-- ============================================
-- 5. PredictionResult — source tracking columns (from 20260222)
-- ============================================
ALTER TABLE "PredictionResult" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "PredictionResult" ADD COLUMN IF NOT EXISTS "actualResult" TEXT;
ALTER TABLE "PredictionResult" ADD COLUMN IF NOT EXISTS "reportedAt" TIMESTAMP(3);

-- Index for new PredictionResult columns
CREATE INDEX IF NOT EXISTS "PredictionResult_actualResult_idx" ON "PredictionResult"("actualResult");

-- ============================================
-- 6. AdmissionCase — essay index
-- ============================================
CREATE INDEX IF NOT EXISTS "AdmissionCase_essayType_idx" ON "AdmissionCase"("essayType");
