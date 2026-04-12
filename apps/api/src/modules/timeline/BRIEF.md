# Module: timeline

## Purpose

Application timeline management with per-school deadline tracking, task management, personal events/tasks, and global event subscriptions.

## Key Files

- `timeline.controller.ts` — Timelines, tasks, personal events/tasks, global events, overview
- `timeline.service.ts` — Thin facade delegating to two sub-services
- `timeline-application.service.ts` — Application timelines with school deadlines and tasks
- `timeline-personal-event.service.ts` — Personal events, global event subscriptions, personal tasks

## Data Model

- `ApplicationTimeline` — Per-school timeline with userId, schoolId, round, status
- `TimelineTask` — Tasks within timelines (title, dueDate, isCompleted, category)
- `PersonalEvent` — User-created events with deadline, eventDate, status, category
- `PersonalTask` — Standalone personal tasks (not tied to a timeline)
- `GlobalEvent` — Platform-wide events (exams, competitions, scholarships)

## Dependencies

PrismaService | AI/LLM: No

## Business Rules

- `generateTimelines` batch-creates timelines for multiple schools with auto-generated tasks
- Overview aggregates both application timeline stats and personal event stats
- Global events can be subscribed to personal timeline
- Personal events have statuses: NOT_STARTED, IN_PROGRESS, COMPLETED
- Tasks support toggle completion (flip isCompleted boolean)

## Gotchas

- Thin facade pattern: `TimelineService` delegates all calls to `TimelineApplicationService` or `TimelinePersonalEventService`
- Overview merges data from both sub-services (app timelines + personal events)
- Timeline creation accepts locale for i18n-aware task generation
- All endpoints require JWT auth (JwtAuthGuard at controller level)
