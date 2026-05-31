---
description: "AI system architecture, LLM patterns, and governance rules"
globs: ["apps/api/src/modules/ai-agent/**", "apps/api/src/modules/ai/**", "apps/api/src/modules/prediction/**", "apps/api/src/modules/essay/**", "apps/api/src/modules/recommendation/**"]
---

# AI System Rules

## LLM Provider Abstraction

All LLM calls go through `ILLMProvider` interface (`ai-agent/providers/`). `LLMProvidersModule.forRoot()` is `global: true` — provides `LLMService`, `ResilienceService`, `TokenTrackerService` as global singletons.

### Unified LLM Service

| Method | Use case | Input | Output |
|--------|----------|-------|--------|
| `chatSimple(messages, options)` | One-shot domain AI | `ChatSimpleMessage[]` | `string` |
| `call(systemPrompt, messages, options)` | Agent loop (tools) | `Message[]` + `LLMOptions` | `LLMResponse` |
| `callStream(systemPrompt, messages, options)` | Streaming agent | `Message[]` + `LLMOptions` | `AsyncGenerator<StreamChunk>` |

## JSON Extraction (MANDATORY)

```typescript
// ALWAYS use:
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
const parsed = extractJsonFromLlm<MyType>(llmResponse);
// NEVER use: result.match(/\{[\s\S]*\}/)
```

## Module Dependency Rules

```
ai-agent/security/  ->  @Global(), no imports needed
ai-agent/providers/ ->  global: true via forRoot(); provides LLMService, ResilienceService, TokenTrackerService
ai-agent/memory/    ->  Import AiAgentMemoryModule for MemoryManagerService
ai-agent/           ->  Import AiAgentModule for OrchestratorService
ai/                 ->  Import AiModule for ProfileAiService, ResumeAiService
```

- Domain modules inject `LLMService` directly — no need to import `AiModule`
- `extractJsonFromLlm` from `common/utils/llm-json.util` (not from `ai-agent/`)
- Never import a service from another module's internal files without importing the module

## Prompt File Convention

Each AI module has `*.prompts.ts` exporting: `buildXxxSystemPrompt(locale, ...context)` and `buildXxxUserPrompt(data, locale)`.

## Prediction x AI Agent Integration

- Prediction belongs to `school` agent — **do NOT create a prediction agent**
- AI chat protocol: optional `context` + `agentHint` (`prediction-results`, `selected-schools`)
- `prediction_ui_context` memory: only for conversation context, **never** calibration/training truth
- Prediction explanation fields (public-safe): `sourceSummary`, `uncertaintyReasons`, `confidenceReason`, `roundContext`, `latestOutcomeLabel`
- **Never** expose `servedTrace`, shadow/challenger results, internal policy gates to users
- Served path = the deterministic **Counselor engine** (`counselor-cold-start-v1.x`, anchor × bounded modifiers); the ML/v5 path was **deleted 2026-05-07** — there is no champion/shadow model. The school agent answers served counselor results only. Fallback multipliers are selectivity-scaled vs published aggregates, not outcome-tuned (see `docs/PREDICTION_DATA_DRIVEN_STRATEGY_2026-05-30.md`).

## Application Analysis Convention

- Canonical API: `GET /profiles/me/ai-analysis`
- `SchoolListItem` is the only target-school source
- Prediction is the only probability/tier source — LLM must not invent a scoring engine
- Render structured contract directly — no markdown parsing or regex
- Mobile is a required consumer when contract changes

## Memory System

Enterprise memory: Redis (hot) + PostgreSQL (cold) + pgvector (semantic search).

## Security

`@Global() AgentSecurityModule`: PromptGuardService (injection detection), ContentModerationService, AuditService.

## Architecture Governance (5 Rules)

| Rule | ID | Severity | Catches |
|------|-----|----------|---------|
| G1 | `optional-security` | error | `@Optional()` on security services |
| G2 | `nl-endpoint-coverage` | error | NL endpoint missing security middleware |
| G3 | `config-consistency` | error | Direct `AGENT_CONFIGS[...]` read outside validator |
| G4 | `user-data-isolation` | warning | Prisma query missing `userId` filter |
| G5 | `dead-provider` | warning | Unused provider in `ai-agent.module.ts` |

Adding NL endpoints: 1) Add to `AgentSecurityMiddleware.forRoutes()`, 2) Add to `nl-endpoints.json`, 3) Run governance check.

Runtime: `ArchitectureValidatorService` runs on startup. Production: missing security = startup fail.
