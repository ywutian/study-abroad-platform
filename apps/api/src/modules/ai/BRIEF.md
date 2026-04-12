# Module: ai

## Purpose

Legacy AI wrapper providing ProfileAiService (profile analysis) and ResumeAiService (resume review/optimize).

## Key Files

- `profile-ai.service.ts` — Red/yellow/green profile analysis with school comparison
- `profile-ai.prompts.ts` — System/user prompt builders for profile analysis
- `resume-ai.service.ts` — Resume review, bullet optimization, section suggestions
- `resume-ai.prompts.ts` — Prompt builders for resume AI features
- `ai.types.ts` — Request/response types for profile analysis

## Data Model

Reads: School (sat25, sat75, acceptanceRate for competitive positioning), Profile. No owned models.

## Dependencies

LLMService (global), PrismaService | AI/LLM: Yes (chatSimpleGuarded for all calls)

## Business Rules

- Profile analysis uses red/yellow/green scoring (1-3 red, 4-6 yellow, 7-10 green)
- School comparison limited to top 3 target schools
- Legacy module: new school-aware analysis should use `/profiles/me/ai-analysis` instead
- `extractJsonFromLlm` for all LLM response parsing

## Gotchas

- No controller — services are imported by other modules (profile, resume)
- `AiService` was removed; only `ProfileAiService` and `ResumeAiService` remain
- Do NOT add new services here; domain modules should inject `LLMService` directly
