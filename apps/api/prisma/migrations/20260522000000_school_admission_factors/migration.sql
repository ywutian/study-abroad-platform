-- CDS Section C7 + C9/C10/C2 detail columns for the admissions-officer
-- evaluation lens (docs/PREDICTION_DATA_MANIFEST.md). All nullable JSON —
-- existing rows backfill as NULL, zero-downtime.
ALTER TABLE "School" ADD COLUMN "admissionFactors" JSONB;
ALTER TABLE "School" ADD COLUMN "classRankDistribution" JSONB;
ALTER TABLE "School" ADD COLUMN "testSubmissionRate" JSONB;
ALTER TABLE "School" ADD COLUMN "waitlistStats" JSONB;
