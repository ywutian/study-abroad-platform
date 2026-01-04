-- Create HNSW indexes for vector similarity search
-- HNSW (Hierarchical Navigable Small World) provides fast approximate nearest neighbor search

-- Index for Memory embeddings
CREATE INDEX IF NOT EXISTS idx_memory_embedding_hnsw 
ON "Memory" USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Index for Entity embeddings  
CREATE INDEX IF NOT EXISTS idx_entity_embedding_hnsw
ON "Entity" USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Note: 
-- m = 16: Max connections per node (higher = more accurate, more memory)
-- ef_construction = 64: Size of dynamic candidate list during index construction
-- vector_cosine_ops: Use cosine similarity (most common for text embeddings)




