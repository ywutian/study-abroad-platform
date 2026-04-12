# Module: admin

## Purpose

Platform administration: user management, data review, reports, calibrations, feature flags, data sync, and audit logging.

## Key Files

- `admin.controller.ts` — Main admin routes (stats, users, reports, calendars, calibrations, templates, broadcast)
- `admin.service.ts` — Core CRUD with audit logging for all sensitive ops
- `admin-review.controller.ts` / `admin-review.service.ts` — Data review pipeline (staging → approved)
- `admin-role.controller.ts` / `admin-role.service.ts` — Role/permission management (RBAC)
- `admin-data-sync.service.ts` — External data sync triggers
- `admin-feature-flag.controller.ts` — Feature flag CRUD + cache invalidation
- `admin-high-school.controller.ts` — High school data management
- `admin-prediction-workflow.controller.ts` — Prediction calibration workflows

## Data Model

AuditLog (userId, action, resource, resourceId, metadata), Report, SchoolDeadline, GlobalEvent, SchoolCalibration, ActivityTemplate, FeatureFlag. Reads most other models for stats/review.

## Dependencies

PrismaService, NotificationService, PredictionService, PredictionCalibrationService, PredictionReportingService, PermissionGuard | AI/LLM: No

## Business Rules

- All routes require `Role.OPERATOR` minimum (set at controller level)
- Every sensitive action (role change, ban, delete) writes to AuditLog
- Stats endpoint filters data by caller's effective permissions
- Broadcast notifications support audience filtering (ALL/VERIFIED/ADMIN)

## Gotchas

- `Role.OPERATOR` is the gate, not `Role.ADMIN` — some sub-controllers further restrict to ADMIN
- Admin imports PredictionService directly for calibration workflows — tight coupling
- `@ThrottleRelaxed()` on entire controller (200 req/min)
