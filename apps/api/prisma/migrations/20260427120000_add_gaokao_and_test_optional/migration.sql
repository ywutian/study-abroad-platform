-- PR-14: add GAOKAO test type + Profile.applyingTestOptional
-- Both additive, default false / no-op for existing rows. Rollback safe.

-- AlterEnum: add GAOKAO to TestType
ALTER TYPE "TestType" ADD VALUE IF NOT EXISTS 'GAOKAO';

-- AlterTable: add applyingTestOptional to Profile (nullable boolean, default false)
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "applyingTestOptional" BOOLEAN DEFAULT false;
