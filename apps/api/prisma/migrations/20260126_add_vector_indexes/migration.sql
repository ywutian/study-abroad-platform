-- 企业级向量索引优化
-- 使用 HNSW 索引提升向量搜索性能

-- ==================== Memory 表向量索引 ====================

-- 创建 HNSW 索引 (推荐用于生产环境)
-- m: 每个节点的最大连接数 (默认16, 更高=更精确但更慢)
-- ef_construction: 构建时的搜索范围 (默认64, 更高=更精确但构建更慢)
CREATE INDEX IF NOT EXISTS idx_memory_embedding_hnsw 
ON "Memory" USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 备选: IVFFlat 索引 (适合超大数据集)
-- lists: 聚类数量 (建议 sqrt(row_count))
-- CREATE INDEX IF NOT EXISTS idx_memory_embedding_ivfflat 
-- ON "Memory" USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- ==================== Entity 表向量索引 ====================

CREATE INDEX IF NOT EXISTS idx_entity_embedding_hnsw 
ON "Entity" USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ==================== 复合索引优化 ====================

-- Memory: userId + type 复合索引 (常用查询模式)
CREATE INDEX IF NOT EXISTS idx_memory_user_type 
ON "Memory" ("userId", "type");

-- Memory: userId + importance 索引 (用于衰减查询)
CREATE INDEX IF NOT EXISTS idx_memory_user_importance 
ON "Memory" ("userId", "importance" DESC);

-- Memory: 过期时间索引 (用于清理任务)
CREATE INDEX IF NOT EXISTS idx_memory_expires_at 
ON "Memory" ("expiresAt") 
WHERE "expiresAt" IS NOT NULL;

-- Entity: userId + type 复合索引
CREATE INDEX IF NOT EXISTS idx_entity_user_type 
ON "Entity" ("userId", "type");

-- AgentMessage: conversationId + createdAt 索引 (消息排序)
CREATE INDEX IF NOT EXISTS idx_agent_message_conv_created 
ON "AgentMessage" ("conversationId", "createdAt" DESC);

-- AgentConversation: userId + updatedAt 索引 (最近对话)
CREATE INDEX IF NOT EXISTS idx_agent_conv_user_updated 
ON "AgentConversation" ("userId", "updatedAt" DESC);

-- ==================== 配置向量搜索参数 ====================

-- 设置 HNSW 搜索参数 (运行时可调整)
-- ef_search: 搜索时的搜索范围 (更高=更精确但更慢, 默认40)
-- 生产环境建议: 100-200
-- ALTER SYSTEM SET hnsw.ef_search = 100;

-- 设置 IVFFlat 搜索参数 (如果使用 IVFFlat)
-- probes: 搜索的聚类数量 (更高=更精确但更慢)
-- ALTER SYSTEM SET ivfflat.probes = 10;

-- ==================== 分析和优化 ====================

-- 更新统计信息
ANALYZE "Memory";
ANALYZE "Entity";
ANALYZE "AgentMessage";
ANALYZE "AgentConversation";

