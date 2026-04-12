# Module: resume

## Purpose

Resume/CV builder with section management, profile import, snapshots (version history), and AI features (review, bullet optimization, content suggestions).

## Key Files

- `resume.controller.ts` — CRUD, sections, profile import, snapshots, AI endpoints
- `resume.service.ts` — Resume logic, section mapping, snapshot restore, AI delegation
- `dto/resume-ai.dto.ts` — AI feature DTOs (review, bullet optimize, suggest content)

## Data Model

- `Resume` — userId, title, type (COLLEGE_APPLICATION | INTERNSHIP | GRADUATE_CV), templateId, language, version
- `ResumeSection` — Ordered sections (HEADER, EDUCATION, ACTIVITIES, AWARDS, etc.) with JSON content
- `ResumeSnapshot` — Version snapshots with full section data for restore
- `ResumeAIReview` — AI review/optimization history records

## Dependencies

ProfileService (import), ResumeAiService (AI features), AuthorizationService | AI/LLM: Indirect (via ResumeAiService)

## Business Rules

- Three resume types with different default section templates
- Profile import maps activities by category (COMMUNITY_SERVICE, WORK, RESEARCH) differently per resume type
- Snapshots capture full state; restore deletes existing sections and recreates from snapshot
- Duplicate creates a deep copy with "(Copy)" suffix
- AI review, bullet optimize, and suggest content all use @ThrottleAI()

## Gotchas

- Ownership verified via `AuthorizationService.verifyOwnership()` pattern
- Section content is untyped JSON — each section type has its own content schema
- Profile import mapping is resume-type-specific (college vs internship vs graduate CV)
- `version` field incremented on snapshot restore
