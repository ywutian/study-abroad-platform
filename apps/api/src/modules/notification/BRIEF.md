# Module: notification

## Purpose

In-app notification system: event-driven dispatch, push tokens, unread counts, and 17+ notification types covering social, content, system, and admin events.

## Key Files

- `notification.controller.ts` — GET list (paginated), unread count, mark read, mark all read, push token registration
- `notification.service.ts` — Notification creation, templates, event listeners, push dispatch
- `dto/register-push-token.dto.ts` — Mobile push token registration

## Data Model

Notification (userId, type, title, content, actorId, relatedId, relatedType, read, createdAt), PushToken (userId, token, platform). In-memory templates for each NotificationType.

## Dependencies

PrismaService, RedisService, EventEmitter2 | AI/LLM: No

## Business Rules

- Listens to events: `CHAT_MESSAGE_OFFLINE`, `NOTIFICATION_PUSH`, `USER_REGISTERED`
- 17 notification types: NEW_FOLLOWER, NEW_MESSAGE, CASE_HELPFUL, POST_REPLY, VERIFICATION_APPROVED, DEADLINE_REMINDER, SYSTEM_BROADCAST, etc.
- Templates generate title/content from event metadata
- Push token management for mobile (Expo push notifications)
- `@ThrottleRelaxed()` on controller

## Gotchas

- NotificationType is a service-level enum, not a Prisma enum
- Other modules import `NotificationService` and `NotificationType` directly from this module
- Event-driven: producers emit events, this module listens and creates notifications
