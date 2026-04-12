# Module: chat

## Purpose

User-to-user messaging with WebSocket real-time delivery, conversation management, file uploads, and content moderation.

## Key Files

- `chat.controller.ts` — REST: conversations CRUD, messages (paginated), file upload, reports
- `chat.service.ts` — Conversation creation (mutual follow required), message persistence, blocking
- `chat.gateway.ts` — WebSocket gateway at `/chat` namespace for real-time message delivery
- `message-filter.service.ts` — Content filtering/moderation for messages
- `chat-admin.controller.ts` — Admin moderation endpoints

## Data Model

Conversation (kind: DM/GROUP), ConversationParticipant (userId, isPinned, lastReadAt), Message (senderId, content, type, attachmentUrl). References: User, Follow (for mutual follow check).

## Dependencies

PrismaService, MessageFilterService, StorageService, ChatGateway | AI/LLM: No

## Business Rules

- Starting a conversation requires VERIFIED/ADMIN role + mutual follow between users
- Block check prevents messaging blocked users
- File uploads: 5MB max, image types only (validated via ParseFilePipe)
- `@ThrottleRelaxed()` for reads, `@ThrottleSensitive()` implied for writes
- Offline messages trigger `CHAT_MESSAGE_OFFLINE` event for push notifications

## Gotchas

- WebSocket namespace is `/chat` (separate from AI agent's `/ai-assistant`)
- Sender select intentionally excludes email for privacy
- Mutual follow is bidirectional — both users must follow each other
