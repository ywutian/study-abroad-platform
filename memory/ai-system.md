# AI System Architecture

## Module Map

Two entry points for LLM calls:

| Service      | Location                               | When to use                                                  |
| ------------ | -------------------------------------- | ------------------------------------------------------------ |
| `AiService`  | `modules/ai/ai.service.ts`             | Simple one-shot calls (essay-ai, recommendation, prediction) |
| `LLMService` | `modules/ai-agent/core/llm.service.ts` | Agent loop calls with retry + circuit breaker + timeout      |

## LLM Provider Abstraction

All LLM calls go through `ILLMProvider` interface (`ai-agent/providers/`).

- Provider selected by `LLM_PROVIDER` env var (default: `openai`)
- `LLMProvidersModule.forRoot()` is `global: true`
- Supports OpenAI, DeepSeek, Azure-compatible endpoints via `OPENAI_BASE_URL`

### Call Chains

- **Simple**: Consumer → `AiService.chat()` → `ILLMProvider.chat()` → OpenAI API
- **Agent**: WebSocket/HTTP → `OrchestratorService` → `AgentRunnerService` → `LLMService` → `ILLMProvider`

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

### Adding New Tools

1. Create `*-tools.service.ts` implementing `IToolHandlerProvider`
2. Define tools in `config/tools.config.ts`
3. Register in `ToolExecutorService` (Map-based registry)
4. Import the domain module in `AiAgentModule`

### JSON Extraction

Always use the helper:

```typescript
import { extractJsonFromLlm } from '../ai-agent/tools/helpers/llm-json.helper';
const parsed = extractJsonFromLlm<MyType>(llmResponse);
```

Never use `result.match(/\{[\s\S]*\}/)`.

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
ai-agent/providers/ →  global: true via forRoot(), no imports needed
ai-agent/memory/    →  Import AiAgentMemoryModule for MemoryManagerService
ai-agent/           →  Import AiAgentModule for OrchestratorService
ai/                 →  Import AiModule for AiService
```

- `AiModule` does NOT import `AiAgentModule` (no circular deps)
- External domain modules are imported by `AiAgentModule` for tool service DI
