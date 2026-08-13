# Module: timeline

## Purpose

Application timeline management with per-school deadline tracking, task management, personal events/tasks, and global event subscriptions.

## Key Files

- `timeline.controller.ts` — Timelines, tasks, personal events/tasks, global events, overview
- `timeline.service.ts` — Thin facade delegating to two sub-services
- `timeline-application.service.ts` — Application timelines with school deadlines and tasks
- `timeline-personal-event.service.ts` — Personal events, global event subscriptions, personal tasks

## Data Model

- `ApplicationTimeline` — Per-school, per-entry-year timeline; unique by userId + schoolId + round + applicationYear
- `ApplicationTask` — Tasks within timelines (title, type, dueDate, completed)
- `PersonalEvent` — User-created events with deadline, eventDate, status, category
- `PersonalTask` — Tasks within a personal event
- `GlobalEvent` — Platform-wide events (exams, competitions, scholarships)

## Dependencies

PrismaService | AI/LLM: No

## Business Rules

- `generateTimelines` batch-creates timelines for multiple schools with auto-generated tasks
- Overview counts the current/future application cycle, not archived history
- Global events can be subscribed to personal timeline
- Personal events have statuses: NOT_STARTED, IN_PROGRESS, COMPLETED, CANCELLED
- Terminal or past-lifecycle records are archived and immutable; personal lifecycle uses the later of deadline/eventDate

## Gotchas

- Thin facade pattern: `TimelineService` delegates all calls to `TimelineApplicationService` or `TimelinePersonalEventService`
- Overview merges data from both sub-services (app timelines + personal events)
- Timeline creation accepts locale for i18n-aware task generation
- Stored application deadlines never roll forward; only recurring GlobalEvent dates do
- All endpoints require JWT auth (JwtAuthGuard at controller level)
