-- Hall §7 Decision C — PIPL stop-the-bleed: peer review pool is opt-OUT.
--
-- The Hall 锐评 (peer review) pool was opt-IN-by-omission: acceptPeerReview
-- defaulted to true, silently enrolling every user — including minors — into
-- a public review surface without affirmative consent. PIPL requires explicit
-- consent for processing personal information, especially for minors.
--
-- This migration is non-destructive (column default flip + pure data UPDATE),
-- so it can ship immediately ahead of the destructive Decision B cleanup:
--   1. Flip the column default true -> false (new users never auto-enrolled)
--   2. Retroactively opt every existing user OUT of the review pool
--   3. Clear every desensitized hall snapshot (hallPublicProfile) so no stale
--      public profile lingers in 锐评/swipe/aggregator surfaces post opt-out;
--      snapshots are rebuilt lazily by HallPublicProfileService on next opt-in.

-- 1. New users default to opted-out
ALTER TABLE "User" ALTER COLUMN "acceptPeerReview" SET DEFAULT false;

-- 2. Retroactively opt out all existing users
UPDATE "User" SET "acceptPeerReview" = false WHERE "acceptPeerReview" = true;

-- 3. Clear all desensitized hall snapshots
UPDATE "User" SET "hallPublicProfile" = NULL WHERE "hallPublicProfile" IS NOT NULL;
