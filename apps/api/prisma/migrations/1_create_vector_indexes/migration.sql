-- Create HNSW indexes for vector similarity search (optional - requires pgvector)
-- Note: Tables may not exist yet at this migration step; indexes will be created in later migrations
DO $$
BEGIN
    -- Check if pgvector is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        -- Index for Memory embeddings (only if table exists)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Memory') THEN
            CREATE INDEX IF NOT EXISTS idx_memory_embedding_hnsw
            ON "Memory" USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
            RAISE NOTICE 'Memory vector index created';
        ELSE
            RAISE NOTICE 'Memory table not yet created, skipping index';
        END IF;

        -- Index for Entity embeddings (only if table exists)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Entity') THEN
            CREATE INDEX IF NOT EXISTS idx_entity_embedding_hnsw
            ON "Entity" USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
            RAISE NOTICE 'Entity vector index created';
        ELSE
            RAISE NOTICE 'Entity table not yet created, skipping index';
        END IF;
    ELSE
        RAISE NOTICE 'pgvector not available, skipping vector indexes';
    END IF;
END $$;









