# ADR-0003: AI Agent Workflow Engine Architecture

- Status: accepted
- Date: 2026-01-20
- Decision-makers: Core Team
- Tags: ai, architecture, workflow

## Context

The AI Agent system initially used a simple architecture where `AgentRunnerService` directly called `LLMService` and `ToolExecutorService` in a linear chain. As features grew (multi-step planning, tool orchestration, memory integration, streaming responses), this linear approach became difficult to maintain and test.

Key pain points:

- `AgentRunnerService` was accumulating too many responsibilities
- Adding new workflow steps required modifying the core runner
- Testing required mocking many low-level services
- No clear separation between planning, execution, and response synthesis

## Decision

Introduce a **WorkflowEngineService** as an intermediary layer between `AgentRunnerService` and the low-level services:

```
AgentRunnerService
  └── WorkflowEngineService (NEW)
        ├── Plan phase    → LLMService (generate plan)
        ├── Execute phase → ToolExecutorService (run tools)
        └── Solve phase   → LLMService (synthesize response)
```

The `WorkflowEngineService`:

- Accepts a user message and context
- Returns a `WorkflowResult` with `message`, `plan`, `toolsUsed`, and `timing` metrics
- Internally manages the Plan → Execute → Solve lifecycle
- Exposes both `run()` (batch) and `runStream()` (streaming) methods

`AgentRunnerService` becomes a thin orchestration layer that:

- Manages conversation context via `MemoryManagerService`
- Delegates to `WorkflowEngineService` for the actual AI workflow
- Handles error recovery and rate limiting

## Consequences

### Positive

- **Separation of concerns**: Runner handles context; Engine handles workflow
- **Testability**: Unit tests for `AgentRunnerService` only need to mock `WorkflowEngineService`
- **Extensibility**: New workflow steps (e.g., reflection, self-critique) can be added inside the engine without changing the runner
- **Observability**: `timing` metrics (planMs, executeMs, solveMs, totalMs) enable performance monitoring
- **Streaming support**: Clean separation between batch and streaming paths

### Negative

- One additional abstraction layer to understand
- Existing tests needed refactoring (mock targets changed from LLMService to WorkflowEngineService)

### Neutral

- The `OrchestratorService` continues to manage multi-agent coordination at a higher level
- Memory management (conversation persistence, entity extraction) remains in `MemoryManagerService`
