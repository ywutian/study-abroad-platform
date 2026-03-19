-- D4: Composite indexes for common query patterns

-- EssayPrompt: schoolId + year + type (common filter combo)
CREATE INDEX IF NOT EXISTS "EssayPrompt_schoolId_year_type_idx" ON "EssayPrompt"("schoolId", "year", "type");

-- User: deletedAt + isBanned (admin queries for active non-banned users)
CREATE INDEX IF NOT EXISTS "User_deletedAt_isBanned_idx" ON "User"("deletedAt", "isBanned");

-- School: country + usNewsRank (filter by country, sort by rank)
CREATE INDEX IF NOT EXISTS "School_country_usNewsRank_idx" ON "School"("country", "usNewsRank");

-- Memory: Remove redundant indexes covered by composite
-- @@index([userId]) is covered by @@index([userId, type, importance])
-- @@index([userId, type]) is covered by @@index([userId, type, importance])
-- @@index([importance]) is rarely queried alone
DROP INDEX IF EXISTS "Memory_userId_idx";
DROP INDEX IF EXISTS "Memory_userId_type_idx";
DROP INDEX IF EXISTS "Memory_importance_idx";

-- D7: pgvector HNSW index for semantic search
-- Uses cosine distance (vector_cosine_ops) matching the app's similarity queries.
-- m=16 and ef_construction=64 are good defaults for ~100K vectors.
CREATE INDEX IF NOT EXISTS "Memory_embedding_hnsw_idx"
  ON "Memory" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
