-- 企业级向量索引优化（仅当表存在时创建，避免空库失败）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Memory') THEN
    CREATE INDEX IF NOT EXISTS idx_memory_embedding_hnsw ON "Memory" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
    CREATE INDEX IF NOT EXISTS idx_memory_user_type ON "Memory" ("userId", "type");
    CREATE INDEX IF NOT EXISTS idx_memory_user_importance ON "Memory" ("userId", "importance" DESC);
    CREATE INDEX IF NOT EXISTS idx_memory_expires_at ON "Memory" ("expiresAt") WHERE "expiresAt" IS NOT NULL;
    ANALYZE "Memory";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Entity') THEN
    CREATE INDEX IF NOT EXISTS idx_entity_embedding_hnsw ON "Entity" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
    CREATE INDEX IF NOT EXISTS idx_entity_user_type ON "Entity" ("userId", "type");
    ANALYZE "Entity";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AgentMessage') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_message_conv_created ON "AgentMessage" ("conversationId", "createdAt" DESC);
    ANALYZE "AgentMessage";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AgentConversation') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_conv_user_updated ON "AgentConversation" ("userId", "updatedAt" DESC);
    ANALYZE "AgentConversation";
  END IF;
END $$;
