# Raw SQL Indexes (Not Declarable in Prisma)

These indexes were created via raw SQL migrations and **cannot** be represented
in `schema.prisma`. They are intentional and must be preserved.

> **DO NOT** remove these indexes if `prisma migrate diff` reports them as drift.

## Memory Table

| Index Name                  | Type             | Definition                                               | Migration                     |
| --------------------------- | ---------------- | -------------------------------------------------------- | ----------------------------- |
| `idx_memory_embedding_hnsw` | HNSW (pgvector)  | `embedding vector_cosine_ops` (m=16, ef_construction=64) | `20260127_add_vector_indexes` |
| `idx_memory_expires_at`     | B-tree (partial) | `"expiresAt" WHERE "expiresAt" IS NOT NULL`              | `20260127_add_vector_indexes` |

## Not Yet Created (from 20260203 migration, marked applied but not executed)

The following indexes were defined in `20260203_memory_index_optimization` but were
never actually created in the database (migration was resolved via `--applied`).
They can be created manually if needed for production performance:

```sql
-- AgentSecurityEvent: unresolved events query
CREATE INDEX idx_security_event_unresolved
  ON "AgentSecurityEvent"("resolved", "severity", "createdAt" DESC)
  WHERE "resolved" = false;

-- AgentTokenUsage: daily usage aggregation
CREATE INDEX idx_token_usage_user_date
  ON "AgentTokenUsage"("userId", DATE("createdAt"));

-- AgentTask: pending task scheduling
CREATE INDEX idx_agent_task_scheduled
  ON "AgentTask"("status", "scheduledAt")
  WHERE "status" = 'PENDING';
```

## School Table (Trigger, not Index)

| Name                   | Type                         | Definition                                    | Migration                        |
| ---------------------- | ---------------------------- | --------------------------------------------- | -------------------------------- |
| `trg_school_name_norm` | BEFORE INSERT/UPDATE trigger | Auto-maintains `nameNorm = LOWER(TRIM(name))` | `20260220_fix_duplicate_schools` |
