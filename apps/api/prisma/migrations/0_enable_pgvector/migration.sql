-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Note: Run this migration first before other migrations
-- If Memory/Entity tables already exist, you'll need to:
-- 1. ALTER TABLE memories ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector(1536);
-- 2. ALTER TABLE entities ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector(1536);




