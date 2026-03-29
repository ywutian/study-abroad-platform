# ADR 0015: TaskQueueService Decommission

**Status**: Pending
**Date**: 2026-03-27
**Context**: `TaskQueueService` is registered as a provider in `ai-agent.module.ts` but not connected to any workflow

## Decision (Proposed)

- `TaskQueueService` is dead code — registered but never injected by any consumer
- G5 governance rule flags it as a warning
- Should be removed once confirmed no future plans depend on it

## Open Questions

- Was this intended for background job processing?
- Is there a planned feature that would use task queuing?
- Should it be replaced with a proper job queue (Bull/BullMQ)?
