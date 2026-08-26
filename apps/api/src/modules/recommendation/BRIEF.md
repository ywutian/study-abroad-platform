# Module: recommendation

## Purpose

AI-assisted school recommendation engine that selects real database schools and uses the Counselor Engine as the sole source for reach/match/safety tiers and probabilities.

## Key Files

- `recommendation.controller.ts` — Generate, preflight check, history, detail, outcome metrics, application confirmation, delete
- `recommendation.service.ts` — LLM-assisted candidate selection with authoritative Counselor Engine enrichment
- `recommendation.prompts.ts` — System/user prompt builders for recommendation LLM calls
- `recommendation.constants.ts` — Prisma select constants and mapper functions

## Data Model

- `SchoolRecommendation` — Saved recommendation with profileSnapshot, preferences, recommendations (JSON), analysis, summary
- `SchoolRecommendationEvent` — Idempotent IMPRESSION/ADDED/REMOVED/APPLIED outcome events

## Dependencies

LLMService, PointsIncentive, Redis (idempotency lock), MemoryManager, PredictionService | AI/LLM: Yes

## Business Rules

- Costs 25 points; refunded on failure via `safeRefund`
- Redis NX lock (2 min) prevents concurrent duplicate requests per user
- LLM-proposed schools are accepted only when they resolve unambiguously to a real School row
- Counselor Engine preview overwrites every LLM-proposed tier and probability before persistence
- Runtime recommendation generation does not read or inject historical individual Case data
- Recommendation events provide an attributable funnel; fewer than 30 attributed school impressions is reported as an insufficient sample, not a hit-rate claim
- Recommendations enriched with essay prompt counts and hasWhySchool flag
- Results recorded to memory system (decisions, entities, preferences) async

## Gotchas

- Preflight checks profile completeness (GPA, test scores, activities, target major required)
- Assessment data (MBTI/Holland) optionally included for richer context
- `@ThrottleAI()` applied at controller level for all endpoints
- Memory recording is fire-and-forget; failures logged but don't block response
- APPLIED is recorded when an attributed application timeline transitions to SUBMITTED; the explicit endpoint remains an idempotent user-confirmed fallback
