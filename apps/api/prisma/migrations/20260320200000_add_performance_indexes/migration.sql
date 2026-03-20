-- Phase 3.4: Performance indexes

-- Forum full-text search (trigram)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "ForumPost_title_trgm_idx" ON "ForumPost" USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ForumPost_content_trgm_idx" ON "ForumPost" USING GIN (content gin_trgm_ops);

-- SchoolListItem composite index (userId + tier)
CREATE INDEX IF NOT EXISTS "SchoolListItem_userId_tier_idx" ON "SchoolListItem" ("userId", "tier");
