# Module: profile

## Purpose

User profile management including test scores, activities, awards, essays, education, GPA, recommendation letters, and AI-powered application analysis.

## Key Files

- `profile.controller.ts` — 30+ endpoints under `/profiles` for all profile sub-resources
- `profile-crud.service.ts` — Core CRUD for profile fields
- `profile-scores.service.ts` — Test score management
- `profile-education.service.ts` — Education history and semester GPAs
- `profile-application-analysis.service.ts` — AI school-aware analysis (red/yellow/green system)
- `profile-enrichment.service.ts` — AI activity sort, refine, Common App description generation
- `profile-helpers.service.ts` — Profile completeness calculation, grade computation

## Data Model

- `Profile` — Main profile (1:1 with User), includes GPA, target major, graduation date
- `TestScore`, `Activity`, `Award`, `Essay`, `Education`, `SemesterGpa`, `RecommendationLetter`
- Target schools proxied to `SchoolListItem` via SchoolListService

## Dependencies

SchoolListService, ProfileApplicationAnalysisService, LLMService | AI/LLM: Indirect (via sub-services)

## Business Rules

- Onboarding creates profile + optional test scores in one call
- Activities support AI sort and AI refine (≤150 chars for Common App)
- Target schools are proxied to SchoolListService (legacy compatibility layer)
- Profile visibility: PRIVATE/PUBLIC/ANONYMOUS/VERIFIED_ONLY with role-based access
- AI analysis endpoint uses @ThrottleAI()

## Gotchas

- `ProfileService` is a thin facade delegating to 7+ sub-services
- Target school endpoints (`/me/target-schools`) proxy to SchoolListService, not stored on Profile
- `getProfile(:id)` enforces visibility check based on viewer role
- AI analysis is the canonical path for school-aware strategy (`/profiles/me/ai-analysis`)
