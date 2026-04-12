# Module: ai-agent

## Purpose

Enterprise multi-agent LLM orchestrator: SSE/WebSocket chat, tool execution, memory, security, rate limiting, token tracking.

## Key Files

- `ai-agent.controller.ts` — POST /ai-agent/chat (SSE streaming), usage stats
- `ai-agent.gateway.ts` — WebSocket gateway `/ai-assistant` for real-time chat
- `core/orchestrator.service.ts` — Multi-agent routing and execution loop
- `core/llm.service.ts` — Unified LLM service (chatSimple, call, callStream) — globally provided
- `memory/memory-manager.service.ts` — Redis (hot) + PostgreSQL (cold) + pgvector semantic search
- `security/prompt-guard.service.ts` — Prompt injection detection
- `config/agents.config.ts` + `tools.config.ts` — Agent/tool definitions (12 tools)

## Data Model

Conversation, Message, Memory (pgvector), TokenUsage. Tool results in message metadata.

## Business Rules

- `@ThrottleAI()` (20 req/min) on controller + AgentThrottleGuard for quota
- SSE: detects client disconnect to stop wasting LLM tokens
- WebSocket auth via JWT in handshake token
- All NL endpoints must be registered in `nl-endpoints.json` for governance

## Gotchas

- `LLMProvidersModule.forRoot()` is `global: true` — LLMService available everywhere without import
- `_components/` in admin/ai-agent is shared by ai-operations admin page — do NOT delete
- Adding NL endpoints requires updating AgentSecurityMiddleware + nl-endpoints.json
- Architecture governance rules G1-G5 enforce security/config patterns at CI time
