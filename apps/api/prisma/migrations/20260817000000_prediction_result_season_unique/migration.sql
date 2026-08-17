-- WP3: PredictionResult unique identity includes applicationYear, matching
-- ApplicationTimeline (profile/school/round/year). Zero-downtime, no backfill.
--
-- #568: null applicationYear rows are season-unknown. Do NOT guess a year from
-- createdAt. They stay until the user re-runs a prediction for a known season.
--
-- Strategy (rollback-safe, no invented seasons):
-- 1. Drop the old (profileId, schoolId) unique so two seasons can coexist.
-- 2. Full unique on (profileId, schoolId, applicationYear) so Prisma upsert
--    ON CONFLICT works for new writes (always stamped with a year).
--    PostgreSQL treats NULL as distinct, so legacy null-year rows do not
--    collide with a later stamped year.
-- 3. Partial unique on (profileId, schoolId) WHERE applicationYear IS NULL
--    keeps at most one unknown-season row (same cardinality as today).

DROP INDEX IF EXISTS "PredictionResult_profileId_schoolId_key";

CREATE UNIQUE INDEX "PredictionResult_profileId_schoolId_applicationYear_key"
  ON "PredictionResult" ("profileId", "schoolId", "applicationYear");

CREATE UNIQUE INDEX "PredictionResult_profileId_schoolId_unknown_season_key"
  ON "PredictionResult" ("profileId", "schoolId")
  WHERE "applicationYear" IS NULL;
