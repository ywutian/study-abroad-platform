# Feature: Agent Chat (AI Assistant)

## Purpose

Multi-agent AI chat system with specialized advisors (essay, school, profile, timeline, resume) and streaming responses.

## Components

- agent-chat — main chat container orchestrating the conversation
- chat-input — message input with quick actions
- chat-message — renders individual messages with agent identity
- message-content — markdown rendering for AI responses
- tool-call-card — displays tool execution status and results
- thinking-indicator — shows AI "thinking" animation during streaming
- conversation-list — sidebar listing past conversations
- floating-chat — floating chat widget (global)
- floating-chat-bridge — event bridge for opening floating chat from anywhere
- ai-assistant-panel — slide-out AI assistant panel
- school-recommendation-cards — inline school recommendation display in chat

## Data Flow

- WebSocket: `/chat` namespace for streaming events (StreamEvent)
- Hooks: `use-agent-chat.ts` (send/receive/stream), `use-chat-history.ts` (conversation CRUD)
- Types from `@study-abroad/shared`: AgentType, StreamEvent, ActionButton

## Patterns

- 6 specialized agents with distinct icons/colors (AGENT_INFO constant)
- Context injection via `AgentChatContext` (prediction results, selected schools)
- Quick actions with i18n keys (QUICK_ACTION_KEYS)
- `debug.ts` for development logging
