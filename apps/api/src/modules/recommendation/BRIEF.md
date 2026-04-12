# Module: recommendation

## Purpose

AI-powered school recommendation engine that generates reach/match/safety school lists based on user profile, preferences, and historical admission data.

## Key Files

- `recommendation.controller.ts` — Generate, preflight check, history, get by ID, delete
- `recommendation.service.ts` — LLM-based recommendation with statistical anchoring
- `recommendation.prompts.ts` — System/user prompt builders for recommendation LLM calls
- `recommendation.constants.ts` — Prisma select constants and mapper functions

## Data Model

- `SchoolRecommendation` — Saved recommendation with profileSnapshot, preferences, recommendations (JSON), analysis, summary

## Dependencies

LLMService, PointsIncentive, Redis (idempotency lock), MemoryManager, PredictionHistoricalService | AI/LLM: Yes

## Business Rules

- Costs 25 points; refunded on failure via `safeRefund`
- Redis NX lock (2 min) prevents concurrent duplicate requests per user
- LLM probability estimates anchored within ±15pp of statistical model baseline
- Three-tier school matching: exact name + alias + fuzzy contains
- Historical case comparison data injected into prompt (admitted vs rejected cohorts)
- Recommendations enriched with essay prompt counts and hasWhySchool flag
- Results recorded to memory system (decisions, entities, preferences) async

## Gotchas

- Preflight checks profile completeness (GPA, test scores, activities, target major required)
- Assessment data (MBTI/Holland) optionally included for richer context
- `@ThrottleAI()` applied at controller level for all endpoints
- Memory recording is fire-and-forget; failures logged but don't block response
