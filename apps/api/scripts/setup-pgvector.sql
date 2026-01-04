-- ===========================================
-- pgvector 初始化脚本
-- 在 Docker 首次启动时自动执行
-- ===========================================

-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 验证
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE NOTICE 'pgvector extension enabled successfully!';
  ELSE
    RAISE EXCEPTION 'Failed to enable pgvector extension';
  END IF;
END $$;
