# ADR 0013: Embedding Version Strategy

**Status**: Accepted
**Date**: 2026-03-27
**Context**: Changing embedding models invalidates stored vectors; no version tracking exists

## Decision

No embedding version field in the database schema. Instead:

1. **Health endpoint reports three states**:
   - `ok` — embeddings exist and are assumed consistent (or DB is empty)
   - `partial` — consistency check failed (e.g., DB query error)
   - `missing` — no Prisma service available

2. **Model changes require re-embedding**: When `EMBEDDING_MODEL` env var changes, a manual re-embedding script must be run. The health endpoint will not detect stale embeddings (by design — version tracking would add schema complexity for a rare operation).

3. **Re-embedding script** (future): `apps/api/scripts/re-embed-memories.ts` with `--apply` flag pattern.

## Consequences

- Simple schema — no `embeddingModelVersion` column
- Embedding model changes are a manual operational procedure
- Health endpoint provides observability but not automatic remediation
