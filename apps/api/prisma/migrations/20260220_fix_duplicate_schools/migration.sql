-- Fix duplicate School records and add enterprise-grade uniqueness constraints.
--
-- Root cause: School table has no unique constraint on name. 14+ data ingestion
-- paths (seed scripts, College Scorecard sync, CSV import, Reddit scraper, etc.)
-- each used their own case-sensitive name matching, creating duplicate records
-- for the same school from different data sources.
--
-- Strategy (mirrors 20260212_fix_duplicate_forum_categories):
--   1. Add new columns (nameNorm, scorecardId, ipedsId)
--   2. Populate from existing data
--   3. Identify canonical record per duplicate group
--   4. Merge data fields from duplicates into canonical
--   5. Reassign all foreign keys (handling compound unique conflicts)
--   6. Delete duplicate records
--   7. Add unique constraints + DB trigger

-- ============================================
-- Step 0: Safety backup
-- ============================================
CREATE TABLE IF NOT EXISTS "_SchoolBackup" AS SELECT * FROM "School";

-- ============================================
-- Step 1: Add new columns (nullable initially)
-- ============================================
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "nameNorm" TEXT;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "scorecardId" TEXT;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "ipedsId" TEXT;

-- ============================================
-- Step 2: Populate new columns from existing data
-- ============================================

-- 2a: nameNorm = LOWER(TRIM(name))
UPDATE "School" SET "nameNorm" = LOWER(TRIM("name"))
WHERE "nameNorm" IS NULL;

-- 2b: Extract scorecardId from metadata JSON
UPDATE "School"
SET "scorecardId" = "metadata"->>'scorecardId'
WHERE "scorecardId" IS NULL
  AND "metadata" IS NOT NULL
  AND "metadata"->>'scorecardId' IS NOT NULL
  AND "metadata"->>'scorecardId' != '';

-- 2c: Extract ipedsId from metadata JSON
UPDATE "School"
SET "ipedsId" = "metadata"->>'ipedsId'
WHERE "ipedsId" IS NULL
  AND "metadata" IS NOT NULL
  AND "metadata"->>'ipedsId' IS NOT NULL
  AND "metadata"->>'ipedsId' != '';

-- ============================================
-- Step 3: Identify canonical record per nameNorm group
-- ============================================
-- Pick the school with most relations, then highest completeness, then oldest.
CREATE TEMP TABLE "_SchoolCanonical" AS
WITH scored AS (
  SELECT
    s.id,
    s."nameNorm",
    (SELECT COUNT(*) FROM "SchoolMetric" WHERE "schoolId" = s.id) +
    (SELECT COUNT(*) FROM "AdmissionCase" WHERE "schoolId" = s.id) +
    (SELECT COUNT(*) FROM "SchoolListItem" WHERE "schoolId" = s.id) +
    (SELECT COUNT(*) FROM "ProfileTargetSchool" WHERE "schoolId" = s.id) +
    (SELECT COUNT(*) FROM "ApplicationTimeline" WHERE "schoolId" = s.id) +
    (SELECT COUNT(*) FROM "SchoolDeadline" WHERE "schoolId" = s.id) +
    (SELECT COUNT(*) FROM "EssayPrompt" WHERE "schoolId" = s.id) AS rel_count,
    (CASE WHEN s."usNewsRank" IS NOT NULL THEN 10 ELSE 0 END) +
    (CASE WHEN s."acceptanceRate" IS NOT NULL THEN 5 ELSE 0 END) +
    (CASE WHEN s."nameZh" IS NOT NULL THEN 3 ELSE 0 END) +
    (CASE WHEN s."satAvg" IS NOT NULL THEN 2 ELSE 0 END) +
    (CASE WHEN s."tuition" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN s."scorecardId" IS NOT NULL THEN 5 ELSE 0 END) +
    (CASE WHEN s."website" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN array_length(s."aliases", 1) > 0 THEN 3 ELSE 0 END) AS completeness,
    s."createdAt"
  FROM "School" s
)
SELECT DISTINCT ON ("nameNorm")
  id AS canonical_id,
  "nameNorm"
FROM scored
ORDER BY "nameNorm", rel_count DESC, completeness DESC, "createdAt" ASC;

-- ============================================
-- Step 4: Merge non-null fields from duplicates into canonical
-- ============================================
UPDATE "School" canonical
SET
  "nameZh"         = COALESCE(canonical."nameZh",         dup."nameZh"),
  "state"          = COALESCE(canonical."state",           dup."state"),
  "city"           = COALESCE(canonical."city",            dup."city"),
  "usNewsRank"     = COALESCE(canonical."usNewsRank",      dup."usNewsRank"),
  "qsRank"         = COALESCE(canonical."qsRank",          dup."qsRank"),
  "acceptanceRate" = COALESCE(canonical."acceptanceRate",  dup."acceptanceRate"),
  "tuition"        = COALESCE(canonical."tuition",         dup."tuition"),
  "avgSalary"      = COALESCE(canonical."avgSalary",       dup."avgSalary"),
  "totalEnrollment"= COALESCE(canonical."totalEnrollment", dup."totalEnrollment"),
  "satAvg"         = COALESCE(canonical."satAvg",          dup."satAvg"),
  "sat25"          = COALESCE(canonical."sat25",           dup."sat25"),
  "sat75"          = COALESCE(canonical."sat75",           dup."sat75"),
  "satMath25"      = COALESCE(canonical."satMath25",       dup."satMath25"),
  "satMath75"      = COALESCE(canonical."satMath75",       dup."satMath75"),
  "satReading25"   = COALESCE(canonical."satReading25",    dup."satReading25"),
  "satReading75"   = COALESCE(canonical."satReading75",    dup."satReading75"),
  "actAvg"         = COALESCE(canonical."actAvg",          dup."actAvg"),
  "act25"          = COALESCE(canonical."act25",           dup."act25"),
  "act75"          = COALESCE(canonical."act75",           dup."act75"),
  "studentCount"   = COALESCE(canonical."studentCount",    dup."studentCount"),
  "graduationRate" = COALESCE(canonical."graduationRate",  dup."graduationRate"),
  "website"        = COALESCE(canonical."website",         dup."website"),
  "logoUrl"        = COALESCE(canonical."logoUrl",         dup."logoUrl"),
  "description"    = COALESCE(canonical."description",     dup."description"),
  "descriptionZh"  = COALESCE(canonical."descriptionZh",  dup."descriptionZh"),
  "scorecardId"    = COALESCE(canonical."scorecardId",     dup."scorecardId"),
  "ipedsId"        = COALESCE(canonical."ipedsId",         dup."ipedsId"),
  "nicheSafetyGrade"  = COALESCE(canonical."nicheSafetyGrade",  dup."nicheSafetyGrade"),
  "nicheLifeGrade"    = COALESCE(canonical."nicheLifeGrade",    dup."nicheLifeGrade"),
  "nicheFoodGrade"    = COALESCE(canonical."nicheFoodGrade",    dup."nicheFoodGrade"),
  "nicheOverallGrade" = COALESCE(canonical."nicheOverallGrade", dup."nicheOverallGrade")
FROM (
  SELECT
    c.canonical_id,
    (array_agg(d."nameZh") FILTER (WHERE d."nameZh" IS NOT NULL))[1] AS "nameZh",
    (array_agg(d."state") FILTER (WHERE d."state" IS NOT NULL))[1] AS "state",
    (array_agg(d."city") FILTER (WHERE d."city" IS NOT NULL))[1] AS "city",
    (array_agg(d."usNewsRank") FILTER (WHERE d."usNewsRank" IS NOT NULL))[1] AS "usNewsRank",
    (array_agg(d."qsRank") FILTER (WHERE d."qsRank" IS NOT NULL))[1] AS "qsRank",
    (array_agg(d."acceptanceRate") FILTER (WHERE d."acceptanceRate" IS NOT NULL))[1] AS "acceptanceRate",
    (array_agg(d."tuition") FILTER (WHERE d."tuition" IS NOT NULL))[1] AS "tuition",
    (array_agg(d."avgSalary") FILTER (WHERE d."avgSalary" IS NOT NULL))[1] AS "avgSalary",
    (array_agg(d."totalEnrollment") FILTER (WHERE d."totalEnrollment" IS NOT NULL))[1] AS "totalEnrollment",
    (array_agg(d."satAvg") FILTER (WHERE d."satAvg" IS NOT NULL))[1] AS "satAvg",
    (array_agg(d."sat25") FILTER (WHERE d."sat25" IS NOT NULL))[1] AS "sat25",
    (array_agg(d."sat75") FILTER (WHERE d."sat75" IS NOT NULL))[1] AS "sat75",
    (array_agg(d."satMath25") FILTER (WHERE d."satMath25" IS NOT NULL))[1] AS "satMath25",
    (array_agg(d."satMath75") FILTER (WHERE d."satMath75" IS NOT NULL))[1] AS "satMath75",
    (array_agg(d."satReading25") FILTER (WHERE d."satReading25" IS NOT NULL))[1] AS "satReading25",
    (array_agg(d."satReading75") FILTER (WHERE d."satReading75" IS NOT NULL))[1] AS "satReading75",
    (array_agg(d."actAvg") FILTER (WHERE d."actAvg" IS NOT NULL))[1] AS "actAvg",
    (array_agg(d."act25") FILTER (WHERE d."act25" IS NOT NULL))[1] AS "act25",
    (array_agg(d."act75") FILTER (WHERE d."act75" IS NOT NULL))[1] AS "act75",
    (array_agg(d."studentCount") FILTER (WHERE d."studentCount" IS NOT NULL))[1] AS "studentCount",
    (array_agg(d."graduationRate") FILTER (WHERE d."graduationRate" IS NOT NULL))[1] AS "graduationRate",
    (array_agg(d."website") FILTER (WHERE d."website" IS NOT NULL))[1] AS "website",
    (array_agg(d."logoUrl") FILTER (WHERE d."logoUrl" IS NOT NULL))[1] AS "logoUrl",
    (array_agg(d."description") FILTER (WHERE d."description" IS NOT NULL))[1] AS "description",
    (array_agg(d."descriptionZh") FILTER (WHERE d."descriptionZh" IS NOT NULL))[1] AS "descriptionZh",
    (array_agg(d."scorecardId") FILTER (WHERE d."scorecardId" IS NOT NULL))[1] AS "scorecardId",
    (array_agg(d."ipedsId") FILTER (WHERE d."ipedsId" IS NOT NULL))[1] AS "ipedsId",
    (array_agg(d."nicheSafetyGrade") FILTER (WHERE d."nicheSafetyGrade" IS NOT NULL))[1] AS "nicheSafetyGrade",
    (array_agg(d."nicheLifeGrade") FILTER (WHERE d."nicheLifeGrade" IS NOT NULL))[1] AS "nicheLifeGrade",
    (array_agg(d."nicheFoodGrade") FILTER (WHERE d."nicheFoodGrade" IS NOT NULL))[1] AS "nicheFoodGrade",
    (array_agg(d."nicheOverallGrade") FILTER (WHERE d."nicheOverallGrade" IS NOT NULL))[1] AS "nicheOverallGrade"
  FROM "_SchoolCanonical" c
  JOIN "School" d ON d."nameNorm" = c."nameNorm" AND d.id != c.canonical_id
  GROUP BY c.canonical_id
) dup
WHERE canonical.id = dup.canonical_id;

-- Step 4b: Merge aliases separately (avoid array_agg on array column)
UPDATE "School" canonical
SET "aliases" = (
  SELECT COALESCE(
    array_agg(DISTINCT elem),
    '{}'
  )
  FROM (
    SELECT unnest(COALESCE(s."aliases", '{}')) AS elem
    FROM "School" s
    WHERE s."nameNorm" = canonical."nameNorm"
  ) sub
  WHERE elem IS NOT NULL
)
FROM "_SchoolCanonical" c
WHERE canonical.id = c.canonical_id;

-- ============================================
-- Step 5: Reassign foreign keys from duplicates to canonical
-- For tables with compound unique constraints: delete conflicting rows first.
-- ============================================

-- 5a: SchoolMetric — @@unique([schoolId, year, metricKey])
DELETE FROM "SchoolMetric" sm
USING "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND sm."schoolId" = dup.id
  AND EXISTS (
    SELECT 1 FROM "SchoolMetric" e
    WHERE e."schoolId" = c.canonical_id
      AND e."year" = sm."year"
      AND e."metricKey" = sm."metricKey"
  );
UPDATE "SchoolMetric" sm
SET "schoolId" = c.canonical_id
FROM "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND sm."schoolId" = dup.id;

-- 5b: ProfileTargetSchool — @@unique([profileId, schoolId])
DELETE FROM "ProfileTargetSchool" pts
USING "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND pts."schoolId" = dup.id
  AND EXISTS (
    SELECT 1 FROM "ProfileTargetSchool" e
    WHERE e."schoolId" = c.canonical_id
      AND e."profileId" = pts."profileId"
  );
UPDATE "ProfileTargetSchool" pts
SET "schoolId" = c.canonical_id
FROM "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND pts."schoolId" = dup.id;

-- 5c: SchoolListItem — @@unique([userId, schoolId])
DELETE FROM "SchoolListItem" sli
USING "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND sli."schoolId" = dup.id
  AND EXISTS (
    SELECT 1 FROM "SchoolListItem" e
    WHERE e."schoolId" = c.canonical_id
      AND e."userId" = sli."userId"
  );
UPDATE "SchoolListItem" sli
SET "schoolId" = c.canonical_id
FROM "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND sli."schoolId" = dup.id;

-- 5d: SchoolDeadline — @@unique([schoolId, year, round])
DELETE FROM "SchoolDeadline" sd
USING "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND sd."schoolId" = dup.id
  AND EXISTS (
    SELECT 1 FROM "SchoolDeadline" e
    WHERE e."schoolId" = c.canonical_id
      AND e."year" = sd."year"
      AND e."round" = sd."round"
  );
UPDATE "SchoolDeadline" sd
SET "schoolId" = c.canonical_id
FROM "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND sd."schoolId" = dup.id;

-- 5e: SchoolEssaySource — @@unique([schoolId, sourceType])
DELETE FROM "SchoolEssaySource" ses
USING "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND ses."schoolId" = dup.id
  AND EXISTS (
    SELECT 1 FROM "SchoolEssaySource" e
    WHERE e."schoolId" = c.canonical_id
      AND e."sourceType" = ses."sourceType"
  );
UPDATE "SchoolEssaySource" ses
SET "schoolId" = c.canonical_id
FROM "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND ses."schoolId" = dup.id;

-- 5f: ApplicationTimeline — @@unique([userId, schoolId, round])
DELETE FROM "ApplicationTimeline" atl
USING "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND atl."schoolId" = dup.id
  AND EXISTS (
    SELECT 1 FROM "ApplicationTimeline" e
    WHERE e."schoolId" = c.canonical_id
      AND e."userId" = atl."userId"
      AND e."round" = atl."round"
  );
UPDATE "ApplicationTimeline" atl
SET "schoolId" = c.canonical_id
FROM "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND atl."schoolId" = dup.id;

-- 5g: PredictionResult — @@unique([profileId, schoolId]), soft FK
DELETE FROM "PredictionResult" pr
USING "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND pr."schoolId" = dup.id
  AND EXISTS (
    SELECT 1 FROM "PredictionResult" e
    WHERE e."schoolId" = c.canonical_id
      AND e."profileId" = pr."profileId"
  );
UPDATE "PredictionResult" pr
SET "schoolId" = c.canonical_id
FROM "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND pr."schoolId" = dup.id;

-- 5h: AdmissionCase — no compound unique, simple reassign
UPDATE "AdmissionCase" ac
SET "schoolId" = c.canonical_id
FROM "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND ac."schoolId" = dup.id;

-- 5i: EssayExample — optional schoolId, no compound unique
UPDATE "EssayExample" ee
SET "schoolId" = c.canonical_id
FROM "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND ee."schoolId" = dup.id;

-- 5j: EssayPrompt — no compound unique on schoolId alone
UPDATE "EssayPrompt" ep
SET "schoolId" = c.canonical_id
FROM "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND ep."schoolId" = dup.id;

-- 5k: Essay — soft FK (optional), no compound unique
UPDATE "Essay"
SET "schoolId" = c.canonical_id
FROM "_SchoolCanonical" c, "School" dup
WHERE dup."nameNorm" = c."nameNorm"
  AND dup.id != c.canonical_id
  AND "Essay"."schoolId" = dup.id;

-- ============================================
-- Step 6: Delete all non-canonical duplicate schools
-- ============================================
DELETE FROM "School" s
USING "_SchoolCanonical" c
WHERE s."nameNorm" = c."nameNorm"
  AND s.id != c.canonical_id;

-- ============================================
-- Step 7: Add constraints
-- ============================================

-- Make nameNorm NOT NULL
ALTER TABLE "School" ALTER COLUMN "nameNorm" SET NOT NULL;

-- Unique index on nameNorm (case-insensitive dedup)
CREATE UNIQUE INDEX "School_nameNorm_key" ON "School"("nameNorm");

-- Unique partial indexes on external IDs
CREATE UNIQUE INDEX "School_scorecardId_key" ON "School"("scorecardId")
  WHERE "scorecardId" IS NOT NULL;

CREATE UNIQUE INDEX "School_ipedsId_key" ON "School"("ipedsId")
  WHERE "ipedsId" IS NOT NULL;

-- Clean up temp table
DROP TABLE IF EXISTS "_SchoolCanonical";

-- ============================================
-- Step 8: DB trigger to auto-maintain nameNorm
-- ============================================
CREATE OR REPLACE FUNCTION school_name_norm_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW."nameNorm" := LOWER(TRIM(NEW."name"));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_school_name_norm
  BEFORE INSERT OR UPDATE OF "name" ON "School"
  FOR EACH ROW
  EXECUTE FUNCTION school_name_norm_trigger();
