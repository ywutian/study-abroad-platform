-- Enable pgvector extension (optional - skip if not available)
-- Railway default PostgreSQL doesn't support pgvector
-- Use Supabase/Neon for vector support
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not available, skipping...';
END $$;









