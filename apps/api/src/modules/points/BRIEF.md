# Module: points

## Purpose

Gamification incentive system: points earning/spending, admin-configurable action values, and global enable/disable toggle.

## Key Files

- `incentive.service.ts` — Core point operations: adjustPoints, charge, getUserPoints, refund. All point mutations go through here.
- `points-config.service.ts` — Dynamic config: per-action point values, global enabled toggle (DB-backed via Settings)
- `points-admin.controller.ts` — Admin: get config, toggle system, update action values (single + batch)
- `dto/points-config.dto.ts` — Admin DTOs for config management
- `refund.helper.ts` — Safe refund utility for failed AI operations

## Data Model

User.points (balance field), PointHistory (userId, action, points, metadata). Config stored in Settings table via PointsConfigService.

## Dependencies

PrismaService, PointsConfigService, EventEmitter2 (listens to USER_REGISTERED for welcome bonus) | AI/LLM: No

## Business Rules

- ALL point mutations must go through `PointsService` — never modify `user.points` directly
- Points system can be globally disabled (all operations return success with 0 balance)
- Action values are admin-configurable at runtime (not hardcoded)
- Negative adjustments (charges) fail if insufficient balance
- Welcome bonus awarded on `USER_REGISTERED` event
- Admin endpoints require `Role.ADMIN` + `Permission.SYSTEM_SETTINGS`

## Gotchas

- Service is named `PointsService` (legacy name) but handles ALL point operations platform-wide
- `PointAction` enum re-exported from `points-config.service.ts` for backward compatibility
- `safeRefund()` helper used by essay-ai and other modules to refund on LLM failure
- `@Optional()` injection in consumer modules means points system is gracefully degradable
