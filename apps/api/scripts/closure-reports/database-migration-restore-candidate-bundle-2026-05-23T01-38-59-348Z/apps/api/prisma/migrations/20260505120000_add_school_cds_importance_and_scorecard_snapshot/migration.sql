-- AlterTable
-- Adds two nullable JSON columns to School. Both default to NULL so the
-- migration is safe to apply against a populated production database with
-- zero downtime — no backfill required.
ALTER TABLE "School" ADD COLUMN "cdsImportanceMatrix" JSONB;
ALTER TABLE "School" ADD COLUMN "scorecardSnapshot" JSONB;
