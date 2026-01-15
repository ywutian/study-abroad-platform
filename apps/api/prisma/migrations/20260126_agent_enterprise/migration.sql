-- ============================================
-- 企业级 Agent 系统数据库扩展
-- ============================================

-- 1. Token 使用记录表
CREATE TABLE IF NOT EXISTS "AgentTokenUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "agentType" TEXT,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(10, 6) NOT NULL DEFAULT 0,
    "toolName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AgentTokenUsage_userId_idx" ON "AgentTokenUsage"("userId");
CREATE INDEX "AgentTokenUsage_userId_createdAt_idx" ON "AgentTokenUsage"("userId", "createdAt");
CREATE INDEX "AgentTokenUsage_agentType_idx" ON "AgentTokenUsage"("agentType");
CREATE INDEX "AgentTokenUsage_createdAt_idx" ON "AgentTokenUsage"("createdAt");

-- 2. 用户配额表
CREATE TABLE IF NOT EXISTS "AgentQuota" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "tier" TEXT NOT NULL DEFAULT 'FREE',  -- FREE, PRO, ENTERPRISE
    "dailyTokens" INTEGER NOT NULL DEFAULT 100000,
    "monthlyTokens" INTEGER NOT NULL DEFAULT 2000000,
    "dailyCost" DECIMAL(10, 2) NOT NULL DEFAULT 5.00,
    "monthlyCost" DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
    "customLimits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AgentQuota_userId_idx" ON "AgentQuota"("userId");
CREATE INDEX "AgentQuota_tier_idx" ON "AgentQuota"("tier");

-- 3. 审计日志表（扩展）
CREATE TABLE IF NOT EXISTS "AgentAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "sessionId" TEXT,
    "traceId" TEXT,
    "action" TEXT NOT NULL,  -- CHAT, TOOL_CALL, MEMORY_ACCESS, CONFIG_CHANGE
    "resource" TEXT NOT NULL,  -- agent, memory, conversation, tool
    "resourceId" TEXT,
    "operation" TEXT NOT NULL,  -- CREATE, READ, UPDATE, DELETE
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',  -- SUCCESS, FAILURE, DENIED
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "duration" INTEGER,  -- milliseconds
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AgentAuditLog_userId_idx" ON "AgentAuditLog"("userId");
CREATE INDEX "AgentAuditLog_traceId_idx" ON "AgentAuditLog"("traceId");
CREATE INDEX "AgentAuditLog_action_idx" ON "AgentAuditLog"("action");
CREATE INDEX "AgentAuditLog_createdAt_idx" ON "AgentAuditLog"("createdAt");
CREATE INDEX "AgentAuditLog_status_idx" ON "AgentAuditLog"("status");

-- 4. 安全事件表
CREATE TABLE IF NOT EXISTS "AgentSecurityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "sessionId" TEXT,
    "eventType" TEXT NOT NULL,  -- PROMPT_INJECTION, PII_DETECTED, RATE_LIMIT, QUOTA_EXCEEDED
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',  -- LOW, MEDIUM, HIGH, CRITICAL
    "description" TEXT NOT NULL,
    "payload" JSONB,
    "mitigationAction" TEXT,  -- BLOCKED, SANITIZED, LOGGED, ALERTED
    "resolved" BOOLEAN NOT NULL DEFAULT FALSE,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AgentSecurityEvent_userId_idx" ON "AgentSecurityEvent"("userId");
CREATE INDEX "AgentSecurityEvent_eventType_idx" ON "AgentSecurityEvent"("eventType");
CREATE INDEX "AgentSecurityEvent_severity_idx" ON "AgentSecurityEvent"("severity");
CREATE INDEX "AgentSecurityEvent_resolved_idx" ON "AgentSecurityEvent"("resolved");
CREATE INDEX "AgentSecurityEvent_createdAt_idx" ON "AgentSecurityEvent"("createdAt");

-- 5. 配置版本表（支持热更新和回滚）
CREATE TABLE IF NOT EXISTS "AgentConfigVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configType" TEXT NOT NULL,  -- AGENT, TOOL, SYSTEM, FEATURE_FLAG
    "configKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "value" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdBy" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "AgentConfigVersion_configType_configKey_version_key" 
    ON "AgentConfigVersion"("configType", "configKey", "version");
CREATE INDEX "AgentConfigVersion_isActive_idx" ON "AgentConfigVersion"("isActive");

-- 6. 向量索引优化（HNSW）
-- 为 Memory 表的 embedding 字段添加 HNSW 索引
CREATE INDEX IF NOT EXISTS "Memory_embedding_hnsw_idx" 
    ON "Memory" USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 7. 记忆压缩记录表
CREATE TABLE IF NOT EXISTS "MemoryCompaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sourceMemoryIds" TEXT[] NOT NULL,
    "compactedMemoryId" TEXT NOT NULL,
    "compressionType" TEXT NOT NULL,  -- MERGE, SUMMARIZE, DEDUPE
    "originalTokens" INTEGER NOT NULL,
    "compactedTokens" INTEGER NOT NULL,
    "compressionRatio" DECIMAL(5, 2) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "MemoryCompaction_userId_idx" ON "MemoryCompaction"("userId");
CREATE INDEX "MemoryCompaction_createdAt_idx" ON "MemoryCompaction"("createdAt");

-- 8. 异步任务表
CREATE TABLE IF NOT EXISTS "AgentTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "type" TEXT NOT NULL,  -- MEMORY_DECAY, MEMORY_COMPACTION, EMBEDDING_BATCH, REPORT_GENERATE
    "status" TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
    "priority" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AgentTask_status_idx" ON "AgentTask"("status");
CREATE INDEX "AgentTask_type_idx" ON "AgentTask"("type");
CREATE INDEX "AgentTask_scheduledAt_idx" ON "AgentTask"("scheduledAt");
CREATE INDEX "AgentTask_priority_status_idx" ON "AgentTask"("priority", "status");
