# ADR 0014: User Data Lifecycle

**Status**: Pending
**Date**: 2026-03-27
**Context**: AI memory stores user data with no defined deletion/retention policy

## Decision (Proposed)

- **Soft delete**: User data deletion sets a `deletedAt` timestamp; actual purge after retention period
- **No cascade**: Deleting a user's memories does not cascade to conversations or entities
- **G4 governance rule**: Warns on Prisma queries missing `userId` filter in AI agent code

## Open Questions

- Retention period duration (30 days? 90 days?)
- GDPR/privacy compliance requirements for the target market
- Whether conversation history should be independently deletable
