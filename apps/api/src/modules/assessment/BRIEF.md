# Module: assessment

## Purpose

Personality and career interest assessments (MBTI Jungian Type + Holland RIASEC) for college applicant self-discovery.

## Key Files

- `assessment.controller.ts` — GET /:type (public), POST / (submit), GET /history/me, GET /result/:id
- `assessment.service.ts` — Question serving, scoring logic, result persistence, memory recording
- `data/mbti-questions.ts` — 48 MBTI questions across 4 dimensions (EI, SN, TF, JP), 5-point Likert
- `data/holland-questions.ts` — Holland RIASEC questions with career code mapping

## Data Model

Assessment (type, userId, answers, result as JSON), references User. Results also written to Memory system for AI agent context.

## Dependencies

PrismaService, MemoryManagerService (@Optional) | AI/LLM: Indirect (results feed into AI agent memory)

## Business Rules

- Questions endpoint is `@Public()` (no auth required)
- Submit/history/result require JWT auth
- MBTI: positive/negative direction scoring across 4 dimensions
- Holland: top-3 RIASEC career codes with matched fields and recommended majors
- Results recorded as `MemoryType` entries for downstream AI/prediction use
- `@ThrottleAI()` on entire controller (because scoring could be compute-heavy)

## Gotchas

- MemoryManagerService is `@Optional()` — module works without ai-agent memory system
- Assessment type enum is a DTO enum (`AssessmentTypeEnum`), not a Prisma enum
- Questions are shuffled on each request (not stable order)
