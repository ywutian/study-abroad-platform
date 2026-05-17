# Module: case

## Purpose

Admission case management: users share real admission results (accepted/rejected/waitlisted) for community data and prediction training.

## Key Files

- `case.controller.ts` — CRUD, public listing with filters, prefill from profile, my cases
- `case.service.ts` — Thin facade delegating to sub-services
- `case-query.service.ts` — Search, filtering (school, year, result, round, major, nationality), pagination
- `case-batch.service.ts` — Batch import, batch verify, admin operations
- `case-memory.service.ts` — Records case data into AI memory system
- `case-admin.controller.ts` — Admin endpoints for case review/management

## Data Model

AdmissionCase (userId, schoolId, year, result, round, major, GPA, SAT/ACT, essays, visibility, qualityScore, reviewStatus). References: School, User, HighSchool, Essay.

## Dependencies

PrismaService, CaseQueryService, CaseBatchService, CaseMemoryService, PointsService (@Optional) | AI/LLM: Indirect (feeds prediction model)

## Business Rules

- Public listing is `@Public()` with Cache-Control headers (30s client, 120s CDN)
- Visibility controls: PRIVATE, PUBLIC, ANONYMOUS, VERIFIED_ONLY
- Quality score computed via `computeCaseQualityScore()` from shared constants
- Points awarded for case submission via PointsService
- Data review pipeline: staging → approved/rejected (admin-controlled)

## Gotchas

- PointsService is `@Optional()` — works without points system
- User role affects what fields are visible in responses (e.g., anon cases hide identity)
- Prefill endpoint pulls data from user's profile to reduce data entry friction
