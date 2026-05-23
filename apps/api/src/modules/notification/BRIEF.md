# Module: notification

## Purpose

In-app notification system: event-driven dispatch, push tokens, unread counts, and 17+ notification types covering social, content, system, and admin events.

## Key Files

- `notification.controller.ts` — GET list (paginated), unread count, mark read, mark all read, push token registration, user notification preferences
- `notification.service.ts` — Notification creation, templates, event listeners, push dispatch, readiness live-channel consent checks
- `dto/register-push-token.dto.ts` — Mobile push token registration
- `dto/update-notification-preferences.dto.ts` — Readiness channel preference updates

## Data Model

Redis notification feed items under `notifications:*` with 30-day TTL, Redis unread counts under `unread_count:*`, Redis push token sets under `notification_push_tokens:*` with 90-day TTL, and Prisma `UserNotificationPreference` rows for durable readiness channel preferences. In-memory templates for each NotificationType. ADR-0021 makes Redis an explicit ephemeral delivery-cache contract, not durable notification history.

## Dependencies

PrismaService, RedisService, EventEmitter2 | AI/LLM: No

## Business Rules

- Listens to events: `CHAT_MESSAGE_OFFLINE`, `NOTIFICATION_PUSH`, `USER_REGISTERED`
- 17 notification types: NEW_FOLLOWER, NEW_MESSAGE, CASE_HELPFUL, POST_REPLY, VERIFICATION_APPROVED, DEADLINE_REMINDER, SYSTEM_BROADCAST, etc.
- Templates generate title/content from event metadata
- Push token management for mobile (Expo push notifications)
- Readiness live-channel consent is read-only and requires explicit user preference; remote push also requires a valid Expo push token
- `@ThrottleRelaxed()` on controller

## Gotchas

- NotificationType is a service-level enum, not a Prisma enum
- Other modules import `NotificationService` and `NotificationType` directly from this module
- Event-driven: producers emit events, this module listens and creates notifications
- Redis feed is not the source of truth for P0/P1 data closure; readiness, deadline, essay, and review states must remain visible from their owning domain models even if Redis is degraded or expired
