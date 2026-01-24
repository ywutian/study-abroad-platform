-- Fix duplicate ForumCategory records
-- Strategy: For each nameZh group, keep the category with the most posts.
-- Reassign all posts from duplicate categories to the canonical one, then delete duplicates.

-- Step 1: Reassign posts from duplicate categories to the canonical (most-posts) category
-- This ensures ZERO data loss - every post is preserved.
WITH canonical AS (
  SELECT DISTINCT ON (fc."nameZh") fc.id, fc."nameZh"
  FROM "ForumCategory" fc
  LEFT JOIN (
    SELECT "categoryId", COUNT(*) AS cnt
    FROM "ForumPost"
    GROUP BY "categoryId"
  ) pc ON pc."categoryId" = fc.id
  WHERE fc."isActive" = true
  ORDER BY fc."nameZh", COALESCE(pc.cnt, 0) DESC, fc."createdAt" ASC
),
duplicates AS (
  SELECT fc.id AS dup_id, c.id AS canonical_id
  FROM "ForumCategory" fc
  JOIN canonical c ON fc."nameZh" = c."nameZh" AND fc.id != c.id
  WHERE fc."isActive" = true
)
UPDATE "ForumPost"
SET "categoryId" = d.canonical_id
FROM duplicates d
WHERE "ForumPost"."categoryId" = d.dup_id;

-- Step 2: Delete the duplicate category records (now have no posts referencing them)
WITH canonical AS (
  SELECT DISTINCT ON (fc."nameZh") fc.id, fc."nameZh"
  FROM "ForumCategory" fc
  LEFT JOIN (
    SELECT "categoryId", COUNT(*) AS cnt
    FROM "ForumPost"
    GROUP BY "categoryId"
  ) pc ON pc."categoryId" = fc.id
  WHERE fc."isActive" = true
  ORDER BY fc."nameZh", COALESCE(pc.cnt, 0) DESC, fc."createdAt" ASC
)
DELETE FROM "ForumCategory"
WHERE "isActive" = true
  AND id NOT IN (SELECT id FROM canonical);

-- Step 3: Add unique constraints to prevent future duplicates
CREATE UNIQUE INDEX "ForumCategory_name_key" ON "ForumCategory"("name");
CREATE UNIQUE INDEX "ForumCategory_nameZh_key" ON "ForumCategory"("nameZh");
