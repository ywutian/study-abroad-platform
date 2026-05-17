-- Hall refactor Phase 1: foundations for Tinder-style review,
-- China Admit Dashboard (verified data center), challenge persistence,
-- and the avgRating double-write fix between hall-review and peer-review.
--
-- All new columns are either nullable or have defaults (safe for prod).
-- Historical avgRating/reviewCount values are backfilled into the peer-* fields
-- because peer-review is the historical owner (hall-review never wrote them).

-- ============================================
-- 1. New enums
-- ============================================

CREATE TYPE "ReviewMethod" AS ENUM ('CLASSIC', 'SWIPE');

CREATE TYPE "ReviewerLevel" AS ENUM ('L1', 'L2', 'L3');

CREATE TYPE "VerificationLevel" AS ENUM ('L1', 'L2', 'L3');

-- ============================================
-- 2. Review: Tinder swipe metadata (Stage 1)
-- ============================================

ALTER TABLE "Review"
  ADD COLUMN "swipeData"          JSONB,
  ADD COLUMN "reviewMethod"       "ReviewMethod" NOT NULL DEFAULT 'CLASSIC',
  ADD COLUMN "reviewerConfidence" INTEGER,
  ADD COLUMN "quickTags"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Review_reviewMethod_idx" ON "Review"("reviewMethod");

-- ============================================
-- 3. User: hall/peer rating split + reviewer L1/L2/L3 + privacy toggle
-- ============================================

ALTER TABLE "User"
  ADD COLUMN "hallAvgRating"       DOUBLE PRECISION,
  ADD COLUMN "hallReviewCount"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "peerAvgRating"       DOUBLE PRECISION,
  ADD COLUMN "peerReviewCount"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "acceptPeerReview"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "reviewerLevel"       "ReviewerLevel" NOT NULL DEFAULT 'L1',
  ADD COLUMN "reviewerCredit"      INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "reviewerQualifiedAt" TIMESTAMP(3);

-- Backfill peer-review fields from the historical avgRating/reviewCount
-- columns (those were only ever written by peer-review.service).
-- hallAvgRating/hallReviewCount start fresh — hall-review never wrote ratings.
UPDATE "User"
SET "peerAvgRating" = "avgRating",
    "peerReviewCount" = COALESCE("reviewCount", 0)
WHERE "avgRating" IS NOT NULL
   OR COALESCE("reviewCount", 0) > 0;

-- ============================================
-- 4. AdmissionCase: 3-level verification (China Admit Dashboard prep)
-- ============================================

ALTER TABLE "AdmissionCase"
  ADD COLUMN "verificationLevel"    "VerificationLevel" NOT NULL DEFAULT 'L1',
  ADD COLUMN "verifiedBy"           TEXT,
  ADD COLUMN "verificationEvidence" JSONB;

-- Existing rows that are marked isVerified=true must move to L2 baseline
-- (platform-verified) so the China Admit Dashboard stats remain consistent.
UPDATE "AdmissionCase"
SET "verificationLevel" = 'L2'
WHERE "isVerified" = true;

-- ============================================
-- 5. ChallengeAttempt: persistence for Hall 学长之路 multi-school predictions
-- ============================================

CREATE TABLE "ChallengeAttempt" (
  "id"              TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "applicantUserId" TEXT NOT NULL,
  "caseIds"         TEXT[] NOT NULL,
  "guesses"         JSONB NOT NULL,
  "correctCount"    INTEGER NOT NULL,
  "totalCount"      INTEGER NOT NULL,
  "accuracy"        INTEGER NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ChallengeAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChallengeAttempt_userId_createdAt_idx"
  ON "ChallengeAttempt"("userId", "createdAt");

CREATE INDEX "ChallengeAttempt_applicantUserId_idx"
  ON "ChallengeAttempt"("applicantUserId");

CREATE INDEX "ChallengeAttempt_accuracy_idx"
  ON "ChallengeAttempt"("accuracy");

ALTER TABLE "ChallengeAttempt"
  ADD CONSTRAINT "ChallengeAttempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
