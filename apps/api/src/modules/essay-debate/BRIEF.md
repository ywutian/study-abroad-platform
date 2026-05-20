# Module: essay-debate

## Purpose

Lets a user argue back against existing AI commentary on an essay
(gallery `AdmissionCase.aiAnalysisCache` or AI feedback on their own `Essay`).
Each turn the backend will inject the 6 context classes documented in
`CONTEXT_AUDIT.md` and call Claude. **PR1 ships the schema + endpoint
skeleton only — the AI response is a mock until PR2.**

## Key Files

- `essay-debate.controller.ts` — `POST /essay-debate/turn` and `GET /essay-debate/:id/latest`
- `essay-debate.service.ts` — Session create/continue, JSON `turns` append, points charge
- `debate-budget.service.ts` — Redis daily caps (30 turns/user, $40/day system)
- `CONTEXT_AUDIT.md` — Day 1 deliverable: the 6 context classes PR2 must wire up
- `dto/` — `CreateDebateTurnDto`, `DebateTurnResponseDto`, `DebateSessionDto`

## Data Model

`EssayDebateSession` — userId + optional admissionCaseId/essayId + JSON `turns`.
`EssayDebateStatus ∈ {ACTIVE, CLOSED}`. All FKs nullable; turns live in a
JSON column because the daily cap keeps the array bounded and turns are
always read together.

## Dependencies

PrismaService, RedisService (budget), PointsService (`AI_ESSAY_DEBATE_TURN`,
cost 0 in PR1). AI/LLM: planned (PR2).

## Business Rules

- Red-team verdict: NO `concedes` in the response shape — only
  `{ rebuttal, evidence[], openQuestion }`. The AI never capitulates.
- Per-user hard cap: 30 turns / UTC day. Returns HTTP 429.
- System-wide hard cap: $40 / UTC day (1 cent/turn placeholder in PR1).
  Returns HTTP 503.
- `@ThrottleAI()` on the controller adds the project-standard 20/min cap.

## Gotchas

- `incrementGlobalSpend` emulates INCRBY via N×INCR because
  `RedisService` doesn't expose `incrby`. Costs more round-trips when PR2
  starts passing larger cent values — switch to a Lua script if needed.
