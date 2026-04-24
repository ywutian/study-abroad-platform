-- Add explicit PredictionAuthority enum so writes to PredictionResult and
-- PredictionSnapshot can declare their authority level. Replaces the fragile
-- modelVersion allowlist in school-list.service.ts. See the in-code BRIEF.md
-- "Authority invariant" section and the check-integration rule
-- `prediction-write-must-declare-authority`.

-- Enum: idempotent create (pattern reused from _add_prediction_school_team_models)
DO $$ BEGIN
  CREATE TYPE "PredictionAuthority" AS ENUM ('AUTHORITATIVE', 'PREVIEW');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Nullable columns: zero-downtime, no constraint violations on existing rows.
ALTER TABLE "PredictionResult"   ADD COLUMN "authority" "PredictionAuthority";
ALTER TABLE "PredictionSnapshot" ADD COLUMN "authority" "PredictionAuthority";

-- Backfill from the existing source field. quick-match is the only historical
-- preview-level writer; everything else (prediction, recommendation,
-- ai-recommend, NULL) is authoritative by construction.
UPDATE "PredictionResult"
   SET "authority" = 'PREVIEW'
 WHERE "source" = 'quick-match';

UPDATE "PredictionResult"
   SET "authority" = 'AUTHORITATIVE'
 WHERE "source" <> 'quick-match' OR "source" IS NULL;

UPDATE "PredictionSnapshot"
   SET "authority" = 'PREVIEW'
 WHERE "source" = 'quick-match';

UPDATE "PredictionSnapshot"
   SET "authority" = 'AUTHORITATIVE'
 WHERE "source" <> 'quick-match' OR "source" IS NULL;

-- Indexes support authority-filtered reads in chinese-outcome-teacher,
-- reporting, training data, and the UI history trend.
CREATE INDEX "PredictionResult_authority_idx"
    ON "PredictionResult" ("authority");

CREATE INDEX "PredictionSnapshot_profileId_schoolId_authority_createdAt_idx"
    ON "PredictionSnapshot" ("profileId", "schoolId", "authority", "createdAt");
