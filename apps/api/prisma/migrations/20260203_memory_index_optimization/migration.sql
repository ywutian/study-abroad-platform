-- Memory 表索引优化
-- P0: 确保向量搜索和常用查询高效

-- 1. 确保 pgvector 扩展已启用
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 用户+类型+重要性复合索引 (补充现有索引)
CREATE INDEX IF NOT EXISTS idx_memory_user_type_importance 
ON "Memory"("userId", type, importance DESC);

-- 3. 用户+分类索引
CREATE INDEX IF NOT EXISTS idx_memory_user_category 
ON "Memory"("userId", category);

-- 4. 访问计数索引 (用于衰减任务)
CREATE INDEX IF NOT EXISTS idx_memory_access_count 
ON "Memory"("accessCount", "lastAccessedAt");

-- 5. 更新时间索引 (用于增量同步)
CREATE INDEX IF NOT EXISTS idx_memory_updated_at 
ON "Memory"("updatedAt" DESC);

-- 6. AgentAuditLog 额外索引优化
CREATE INDEX IF NOT EXISTS idx_audit_user_action_created 
ON "AgentAuditLog"("userId", "action", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_audit_resource_created 
ON "AgentAuditLog"("resource", "createdAt" DESC);

-- 7. AgentSecurityEvent 复合索引
CREATE INDEX IF NOT EXISTS idx_security_event_user_type_created 
ON "AgentSecurityEvent"("userId", "eventType", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_security_event_unresolved 
ON "AgentSecurityEvent"("resolved", "severity", "createdAt" DESC)
WHERE "resolved" = false;

-- 8. AgentTokenUsage 时间范围查询索引
CREATE INDEX IF NOT EXISTS idx_token_usage_user_date 
ON "AgentTokenUsage"("userId", DATE("createdAt"));

-- 9. AgentTask 调度索引
CREATE INDEX IF NOT EXISTS idx_agent_task_scheduled 
ON "AgentTask"("status", "scheduledAt")
WHERE "status" = 'PENDING';

-- 更新统计信息
ANALYZE "Memory";
ANALYZE "AgentAuditLog";
ANALYZE "AgentSecurityEvent";
ANALYZE "AgentTokenUsage";
ANALYZE "AgentTask";
