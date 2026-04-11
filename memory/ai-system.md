# AI System Architecture

## Module Map

Two entry points for LLM calls:

All LLM calls go through `LLMService` (globally provided by `LLMProvidersModule.forRoot()`):

| Method                           | Use case                 | Input                      | Output                        |
| -------------------------------- | ------------------------ | -------------------------- | ----------------------------- |
| `chatSimple(messages, options)`  | One-shot domain AI calls | `ChatSimpleMessage[]`      | `string`                      |
| `call(systemPrompt, msgs, opts)` | Agent loop (with tools)  | `Message[]` + `LLMOptions` | `LLMResponse`                 |
| `callStream(prompt, msgs, opts)` | Streaming agent loop     | `Message[]` + `LLMOptions` | `AsyncGenerator<StreamChunk>` |

**Note**: The legacy `AiService` has been removed. All domain consumers use `LLMService.chatSimple()` directly.

## LLM Provider Abstraction

All LLM calls go through `ILLMProvider` interface (`ai-agent/providers/`).

- Provider selected by `LLM_PROVIDER` env var (default: `openai`)
- `LLMProvidersModule.forRoot()` is `global: true`
- Supports OpenAI, DeepSeek, Azure-compatible endpoints via `OPENAI_BASE_URL`

### Call Chains

- **Simple**: Consumer → `LLMService.chatSimple()` → resilience → `ILLMProvider.chat()` → OpenAI API
- **Agent**: WebSocket/HTTP → `OrchestratorService` → `AgentRunnerService` → `LLMService.call()` → resilience → `ILLMProvider`

## Tool System

12 domain tool services implementing `IToolHandlerProvider` interface:

| Tool Service                 | Domain                        | File                                    |
| ---------------------------- | ----------------------------- | --------------------------------------- |
| `ProfileToolsService`        | Student profiles, test scores | `tools/profile-tools.service.ts`        |
| `SchoolToolsService`         | School database queries       | `tools/school-tools.service.ts`         |
| `PredictionToolsService`     | Admission probability         | `tools/prediction-tools.service.ts`     |
| `RecommendationToolsService` | School recommendations        | `tools/recommendation-tools.service.ts` |
| `EssayToolsService`          | Essay review, brainstorm      | `tools/essay-tools.service.ts`          |
| `CaseToolsService`           | Admission cases               | `tools/case-tools.service.ts`           |
| `ForumToolsService`          | Forum search                  | `tools/forum-tools.service.ts`          |
| `RankingToolsService`        | School rankings               | `tools/ranking-tools.service.ts`        |
| `TimelineToolsService`       | Deadlines, events             | `tools/timeline-tools.service.ts`       |
| `AssessmentToolsService`     | MBTI/Holland assessments      | `tools/assessment-tools.service.ts`     |
| `SearchToolsService`         | Cross-domain search           | `tools/search-tools.service.ts`         |
| `ResumeToolsService`         | Resume generation             | `tools/resume-tools.service.ts`         |

Prediction ownership and boundaries:

- prediction 能力归属 `school agent`，不是独立 agent
- UI 可以通过 `/ai-agent/chat` 传 `prediction-results` / `selected-schools` context
- `prediction_ui_context` memory 只用于会话理解，不进入 calibration / training truth
- 用户侧预测解释只消费公开安全字段：`sourceSummary`、`uncertaintyReasons`、`confidenceReason`、`roundContext`、`latestOutcomeLabel`

### Adding New Tools

1. Create `*-tools.service.ts` implementing `IToolHandlerProvider`
2. Define tools in `config/tools.config.ts`
3. Register in `ToolExecutorService` (Map-based registry)
4. Import the domain module in `AiAgentModule`

### JSON Extraction

Always use the helper:

```typescript
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
const parsed = extractJsonFromLlm<MyType>(llmResponse);
```

Never use `result.match(/\{[\s\S]*\}/)`.

## Application Analysis

Canonical endpoint: `GET /profiles/me/ai-analysis`

Ownership:

- Orchestration lives in `modules/profile/profile-application-analysis.service.ts`
- Prompt builders live in `modules/profile/profile-application-analysis.prompts.ts`
- Shared contract lives in `packages/shared/src/types/ai-agent.ts`

Design rules:

- `SchoolListItem` is the single source of target-school context.
- `PredictionResult` is the single source of probability/tier context.
- `LLMService.chatSimple()` is used only for synthesis, not for inventing probabilities or target-school lists.
- Consumers must use the structured response directly. Do not reintroduce markdown parsing or regex extraction for profile analysis clients.
- Mobile is a first-class consumer whenever the shared application-analysis contract changes.
- Canonical mobile surfaces are `/profile` (summary card), `/profile/analysis` (detail screen), and `/prediction` (analysis CTA).
- `targetSchoolInsights[].policyContext` is part of the shared contract. Clients must render school testing / aid / round policy from this field and must not infer school policy independently.
- `GET /profiles/me/grade` remains legacy-only and must not be used for new school-aware analysis clients.
- `ApplicationAnalysisPolicyVersion` / `SchoolPolicyEvidence` / `ApplicationAnalysisEvaluationRun` now form the V2 governance layer behind applicant runtime.
- Admin workflow lives at `/admin/application-analysis-workflow`; applicant runtime only consumes `ACTIVE` policy output.
- `ApplicationAnalysisExperimentVersion` / `ApplicationAnalysisExperimentEvaluationRun` now form the V3 capability layer for `RECOURSE`, `UNCERTAINTY`, and `FAIRNESS`.
- V3 fields are additive only: `meta.experimentalVersions`, `targetSchoolInsights[].recourseGuidance`, `targetSchoolInsights[].strategyUncertainty`, and `fairnessDisclosure`.
- Applicant runtime only exposes V3 fields when the capability has an `ACTIVE` or request-eligible `CANARY` experiment version and the matching feature flag passes.
- If a capability is retired or disabled, web and mobile must silently fall back to the stable V2/V1 contract without placeholder failure UI.
- `ApplicationAnalysisExperimentScheduler` runs a nightly sweep for `SHADOW / CANARY / ACTIVE` experiments and shares the same orchestration path as the admin `experiments/sweep` trigger.

Cache rules:

- Cache key includes locale, analysis version, profile freshness, school-list freshness, and school count.
- Profile edits and school-list edits both invalidate application analysis cache.
- Active policy changes and approved school-policy evidence reviews also invalidate application analysis cache.

## Memory System

Enterprise memory architecture:

- **Hot layer**: Redis cache for recent conversations and context
- **Cold layer**: PostgreSQL for persistent memory storage
- **Semantic layer**: pgvector (1536-dim embeddings) for similarity search
- **Manager**: `MemoryManagerService` orchestrates all three layers

Location: `modules/ai-agent/memory/`

## Resilience

`ResilienceService` provides:

- Retry with exponential backoff
- Circuit breaker (half-open → open → closed)
- Timeout enforcement
- Token usage tracking via `TokenTrackerService`

## Security

`@Global() AgentSecurityModule` provides:

- `PromptGuardService` — injection detection
- `ContentModerationService` — harmful content filtering
- `AuditService` — security event logging

## Admin Endpoints

`AgentAdminController` (`admin/ai-agent/`) provides:

- Agent configuration management
- Token usage analytics
- Memory management (view, clear, search)
- Performance metrics

## Module Dependency Rules

```
ai-agent/security/  →  @Global(), no imports needed
ai-agent/providers/ →  global: true via forRoot(); provides LLMService, ResilienceService, TokenTrackerService
ai-agent/memory/    →  Import AiAgentMemoryModule for MemoryManagerService
ai-agent/           →  Import AiAgentModule for OrchestratorService
ai/                 →  Import AiModule for ProfileAiService, ResumeAiService
profile/            →  Import ProfileModule for ProfileApplicationAnalysisService
```

- `LLMService`, `ResilienceService`, `TokenTrackerService` are globally provided — no module import needed
- `AiModule` provides `ProfileAiService` and `ResumeAiService`
- `ProfileApplicationAnalysisService` is owned by `ProfileModule`, not `AiModule`
- External domain modules are imported by `AiAgentModule` for tool service DI
