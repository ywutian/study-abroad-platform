-- Schema Alignment Migration
-- Purpose: Sync DB indexes with schema.prisma declarations
-- Context: Raw SQL migrations (20260127, 20260203) created indexes not tracked by Prisma.
--          This migration renames them to Prisma conventions to eliminate schema drift.

-- ============================================================
-- 1. AgentConversation: rename raw SQL index to Prisma convention
-- ============================================================
ALTER INDEX IF EXISTS "idx_agent_conv_user_updated" RENAME TO "AgentConversation_userId_updatedAt_idx";

-- ============================================================
-- 2. AgentMessage: rename raw SQL index to Prisma convention
-- ============================================================
ALTER INDEX IF EXISTS "idx_agent_message_conv_created" RENAME TO "AgentMessage_conversationId_createdAt_idx";

-- ============================================================
-- 3. Memory: rename raw SQL indexes to Prisma conventions
-- ============================================================
ALTER INDEX IF EXISTS "idx_memory_user_type" RENAME TO "Memory_userId_type_idx";
ALTER INDEX IF EXISTS "idx_memory_user_importance" RENAME TO "Memory_userId_importance_idx";

-- Memory composite indexes from 20260203 migration
ALTER INDEX IF EXISTS "idx_memory_user_type_importance" RENAME TO "Memory_userId_type_importance_idx";
ALTER INDEX IF EXISTS "idx_memory_user_category" RENAME TO "Memory_userId_category_idx";
ALTER INDEX IF EXISTS "idx_memory_access_count" RENAME TO "Memory_accessCount_lastAccessedAt_idx";
ALTER INDEX IF EXISTS "idx_memory_updated_at" RENAME TO "Memory_updatedAt_idx";

-- ============================================================
-- 4. AgentAuditLog: rename raw SQL indexes to Prisma conventions
-- ============================================================
ALTER INDEX IF EXISTS "idx_audit_user_action_created" RENAME TO "AgentAuditLog_userId_action_createdAt_idx";
ALTER INDEX IF EXISTS "idx_audit_resource_created" RENAME TO "AgentAuditLog_resource_createdAt_idx";

-- ============================================================
-- 5. AgentSecurityEvent: rename raw SQL index to Prisma convention
-- ============================================================
ALTER INDEX IF EXISTS "idx_security_event_user_type_created" RENAME TO "AgentSecurityEvent_userId_eventType_createdAt_idx";

-- ============================================================
-- 6. Entity: drop redundant index (covered by @@unique([userId, type, name]))
-- ============================================================
DROP INDEX IF EXISTS "idx_entity_user_type";

-- ============================================================
-- 7. School: replace partial unique indexes with standard unique indexes
--    PostgreSQL treats NULLs as distinct in UNIQUE, so behavior is identical.
-- ============================================================
DROP INDEX IF EXISTS "School_scorecardId_key";
CREATE UNIQUE INDEX "School_scorecardId_key" ON "School"("scorecardId");

DROP INDEX IF EXISTS "School_ipedsId_key";
CREATE UNIQUE INDEX "School_ipedsId_key" ON "School"("ipedsId");

-- ============================================================
-- 8. Cleanup: drop backup table from 20260220 deduplication migration
-- ============================================================
DROP TABLE IF EXISTS "_SchoolBackup";
