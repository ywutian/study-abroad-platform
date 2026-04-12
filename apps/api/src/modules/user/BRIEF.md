# Module: user

## Purpose

User account management including dashboard aggregation, GDPR data export, soft/hard delete, points system, and referral program.

## Key Files

- `user.controller.ts` — Dashboard, current user, delete account, export, points, referrals
- `user.service.ts` — CRUD, soft delete (GDPR), hard delete, referral codes, referral stats
- `dashboard.service.ts` — Aggregated dashboard data (profile, predictions, activity)

## Data Model

- `User` — email, passwordHash, role, points, referralCode, referredById, deletedAt (soft delete)
- `PointHistory` — userId, action, points, metadata
- `Follow`, `Block` — Social graph relationships

## Dependencies

DashboardService, CaseIncentiveService, PointsConfigService | AI/LLM: No

## Business Rules

- Soft delete anonymizes email, hashes password to "DELETED", sets deletedAt timestamp
- Soft delete also: revokes refresh tokens, anonymizes messages, privatizes cases, removes follows/blocks
- GDPR export returns all user data as downloadable JSON (excludes passwordHash)
- Referral codes are 12-char uppercase hex, generated on first access
- Points summary calculates total earned/spent from history
- Dashboard endpoint delegates to DashboardService for aggregated view

## Gotchas

- `findById` excludes soft-deleted users (`deletedAt: null` filter)
- Hard delete is irreversible — cascades through all related data in a transaction
- `safeDelete` utility handles non-critical cleanup failures gracefully
- Points history enriched with Chinese descriptions from PointsConfigService at controller level
