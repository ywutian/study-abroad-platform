# ADR 0012: Memory Tier as Metadata Only

**Status**: Accepted
**Date**: 2026-03-27
**Context**: Memory system has conceptual tiers (L1-L4) but no runtime enforcement

## Decision

Memory tiers (L1 conversation, L2 short-term, L3 long-term, L4 entity) are **metadata labels** only:

- Used for documentation, admin UI display, and decay priority
- No runtime routing logic switches on tier values
- `MemoryType` enum in Prisma schema serves as the tier indicator

## Consequences

- No code changes needed — current implementation already treats tiers as metadata
- Admin memory browser can filter/sort by tier for observability
- Memory decay service uses tier as a scoring factor, not a hard routing decision
