-- Application timelines are historical, cycle-bound records. Previously the
-- unique key omitted the fall-entry year, so an archived school+round blocked
-- the next cycle and active past deadlines were rolled forward at read time.
--
-- The database default keeps this migration compatible with the previous app
-- revision while revisions overlap: old code that does not send the new field
-- still writes the current fall-entry cycle. New code always sends the field.
-- Historical rows are then corrected from the stored deadline (Aug-Dec
-- deadlines belong to the following fall-entry year); undated legacy rows fall
-- back to the season in which the row was created.
--
-- Prisma executes PostgreSQL migrations in a transaction, so CONCURRENTLY is
-- not available here. Bound lock acquisition and execution time instead; a
-- busy deployment fails safely and can be retried rather than waiting without
-- limit while holding the migration transaction open.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE "ApplicationTimeline"
ADD COLUMN "applicationYear" INTEGER NOT NULL DEFAULT (
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
  + CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 8 THEN 1 ELSE 0 END
);

UPDATE "ApplicationTimeline"
SET "applicationYear" = CASE
  WHEN "deadline" IS NOT NULL AND EXTRACT(MONTH FROM "deadline") >= 8
    THEN EXTRACT(YEAR FROM "deadline")::INTEGER + 1
  WHEN "deadline" IS NOT NULL
    THEN EXTRACT(YEAR FROM "deadline")::INTEGER
  WHEN EXTRACT(MONTH FROM "createdAt") >= 8
    THEN EXTRACT(YEAR FROM "createdAt")::INTEGER + 1
  ELSE EXTRACT(YEAR FROM "createdAt")::INTEGER
END;

CREATE UNIQUE INDEX "ApplicationTimeline_userId_schoolId_round_applicationYear_key"
  ON "ApplicationTimeline"("userId", "schoolId", "round", "applicationYear");
CREATE INDEX "ApplicationTimeline_userId_applicationYear_idx"
  ON "ApplicationTimeline"("userId", "applicationYear");
DROP INDEX "ApplicationTimeline_userId_schoolId_round_key";
