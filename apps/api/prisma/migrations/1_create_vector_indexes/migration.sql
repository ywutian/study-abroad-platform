-- Create HNSW indexes for vector similarity search (optional - requires pgvector)
DO $$
BEGIN
    -- Check if pgvector is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        -- Index for Memory embeddings
        CREATE INDEX IF NOT EXISTS idx_memory_embedding_hnsw 
        ON "Memory" USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);

        -- Index for Entity embeddings  
        CREATE INDEX IF NOT EXISTS idx_entity_embedding_hnsw
        ON "Entity" USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
        
        RAISE NOTICE 'Vector indexes created successfully';
    ELSE
        RAISE NOTICE 'pgvector not available, skipping vector indexes';
    END IF;
END $$;









