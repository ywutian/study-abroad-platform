-- CreateEnum
CREATE TYPE "TierSource" AS ENUM ('PREDICTED', 'MANUAL');

-- AlterTable
-- New column is NOT NULL with a DEFAULT, so existing rows backfill safely (zero-downtime).
ALTER TABLE "SchoolListItem" ADD COLUMN "tierSource" "TierSource" NOT NULL DEFAULT 'PREDICTED';
