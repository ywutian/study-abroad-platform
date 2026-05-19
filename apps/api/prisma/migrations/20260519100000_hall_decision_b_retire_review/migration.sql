-- ============================================================================
-- Hall §7 Decision B + C6 — Retire the peer review feature (DESTRUCTIVE)
-- ============================================================================
-- This is a DELIBERATE, ratified destructive migration. It fully removes the
-- Hall peer-review subsystem (the 锐评 / "Review" feature):
--   * DROP TABLE Review, ReviewReaction
--   * DROP ENUM ReviewStatus, ReviewMethod
--   * DROP COLUMN User.acceptPeerReview (review opt-in flag)
--   * DROP COLUMN SwipeStats.streak / bestStreak / badge /
--     dailyChallengeCount / dailyChallengeDate (de-gamification, C6)
--   * DROP INDEX SwipeStats_badge_idx
--
-- The DROP statements WILL discard existing rows/columns. This is intended:
-- the review feature, the reviewer L1->L2 quiz, and the AI review coach are
-- all being retired. The check-migration-safety script is expected to flag
-- these DROPs; that is acknowledged and accepted for this migration.
--
-- NOT touched (separate features / deliberate keep):
--   * peer-review module / PeerReview model (separate 1-on-1 feature)
--   * User.reviewerLevel / reviewerCredit / reviewerQualifiedAt / hallAvgRating
--     / hallReviewCount and enum ReviewerLevel — left as orphan columns for a
--     later non-Hall cleanup migration.
--   * enum ReportTargetType value REVIEW — historical Report rows reference it.
-- ============================================================================

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_profileUserId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_reviewerId_fkey";

-- DropForeignKey
ALTER TABLE "ReviewReaction" DROP CONSTRAINT "ReviewReaction_reviewId_fkey";

-- DropForeignKey
ALTER TABLE "ReviewReaction" DROP CONSTRAINT "ReviewReaction_userId_fkey";

-- DropIndex
DROP INDEX "SwipeStats_badge_idx";

-- AlterTable
ALTER TABLE "SwipeStats" DROP COLUMN "badge",
DROP COLUMN "bestStreak",
DROP COLUMN "dailyChallengeCount",
DROP COLUMN "dailyChallengeDate",
DROP COLUMN "streak";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "acceptPeerReview";

-- DropTable
DROP TABLE "Review";

-- DropTable
DROP TABLE "ReviewReaction";

-- DropEnum
DROP TYPE "ReviewMethod";

-- DropEnum
DROP TYPE "ReviewStatus";
