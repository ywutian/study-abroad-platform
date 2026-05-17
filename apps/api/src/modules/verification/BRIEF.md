# Module: verification

## Purpose

Identity verification for admission cases — users submit proof documents, admins review and approve/reject, which upgrades user role to VERIFIED.

## Key Files

- `verification.controller.ts` — Submit, list my verifications, admin: pending list, stats, detail, review
- `verification.service.ts` — File upload, submit, review workflow, stats

## Data Model

- `VerificationRequest` — userId, caseId, proofType, proofData, proofUrl, status (PENDING/APPROVED/REJECTED), reviewerId, reviewNote
- Links to `AdmissionCase` (sets isVerified + reviewStatus on approval)
- Links to `User` (upgrades role to VERIFIED on approval)

## Dependencies

StorageService (file upload), PointsService (points reward), NotificationService | AI/LLM: No

## Business Rules

- Must provide proof material (proofData or proofUrl); rejects without it
- One pending verification per case (blocks duplicate submissions)
- Already-verified cases cannot be re-submitted
- Approval triggers: case.isVerified=true, case.reviewStatus=APPROVED, user.role=VERIFIED
- Points rewarded on approval (VERIFICATION_APPROVED action)
- Notification sent async on review completion (approved or rejected)
- File upload validates type (image/pdf) and size (max 10MB)

## Gotchas

- `@ThrottleStrict()` at controller level (3 req/min) — most restrictive throttle
- Admin endpoints use `@Roles(Role.ADMIN)` decorator
- Notification dispatch is fire-and-forget; failures logged but don't block
- File storage uses `StorageService` (S3 in production, local in dev)
