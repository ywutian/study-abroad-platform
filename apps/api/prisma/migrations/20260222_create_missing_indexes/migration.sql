-- Create Missing Composite Indexes
-- Purpose: The 20260203 migration's indexes were marked as applied but never
--          executed in the actual database. This migration creates them properly.

-- ============================================================
-- 1. Memory: composite indexes for AI agent query patterns
-- ============================================================
CREATE INDEX IF NOT EXISTS "Memory_userId_type_importance_idx"
  ON "Memory"("userId", "type", "importance" DESC);

CREATE INDEX IF NOT EXISTS "Memory_userId_category_idx"
  ON "Memory"("userId", "category");

CREATE INDEX IF NOT EXISTS "Memory_accessCount_lastAccessedAt_idx"
  ON "Memory"("accessCount", "lastAccessedAt");

CREATE INDEX IF NOT EXISTS "Memory_updatedAt_idx"
  ON "Memory"("updatedAt" DESC);

-- ============================================================
-- 2. AgentAuditLog: composite indexes for audit queries
-- ============================================================
CREATE INDEX IF NOT EXISTS "AgentAuditLog_userId_action_createdAt_idx"
  ON "AgentAuditLog"("userId", "action", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "AgentAuditLog_resource_createdAt_idx"
  ON "AgentAuditLog"("resource", "createdAt" DESC);

-- ============================================================
-- 3. AgentSecurityEvent: composite index for security monitoring
-- ============================================================
CREATE INDEX IF NOT EXISTS "AgentSecurityEvent_userId_eventType_createdAt_idx"
  ON "AgentSecurityEvent"("userId", "eventType", "createdAt" DESC);
