# ADR-0021: Notification Retention And Readiness Delivery

- Status: accepted
- Date: 2026-05-20
- Decision-makers: Codex data-closure goal
- Tags: notification, retention, redis, readiness, data-closure

## Context

The platform data field matrix identified notification persistence as ambiguous. The API implementation stores notification feed items in Redis keys (`notifications:*`) with a 30-day TTL, unread counts in Redis keys (`unread_count:*`), and push tokens in Redis sets (`notification_push_tokens:*`) with a 90-day TTL. There is no Prisma `Notification` or `PushToken` model in the current schema.

This matters for the long-running data closure goal because application-critical data surfaces such as profile readiness, timelines, deadlines, essay prompts, and application analysis should not appear closed merely because a notification was sent. Notifications are useful nudges, but they are not a durable source of truth for whether a user still has a missing GPA anchor, school list, essay task, or deadline action.

## Decision

Keep the current notification system as a Redis-backed ephemeral delivery cache for now:

- Redis notification feed items are retained for up to 30 days.
- Redis push tokens are retained for up to 90 days and refreshed by client registration.
- Unread counts are Redis runtime state and may be recomputed or reset when the feed is cleared.
- Notification delivery is best-effort; Redis or Expo push degradation must not hide the underlying P0/P1 product state.
- Readiness live-channel consent is inspected through the notification preference model before live Redis feed, remote push, or email channels can be considered; remote push additionally requires valid Expo push-token presence.

For P0/P1 data closure, the durable source of truth remains the owning domain model or service:

- Profile readiness lives in `ProfileReadinessService` and the profile/school-list/timeline/prediction source models.
- Deadline reminders derive from `ApplicationTimeline`, `ApplicationTask`, `SchoolDeadline`, and personal event/task rows.
- Essay prompt alerts derive from `EssayPrompt`, `EssayPromptSource`, and school-list membership.
- Case review notifications derive from `AdmissionCase` and review state.

Live notification dispatch for readiness campaigns is allowed only after product copy, consent/opt-out, and frequency-cap rules are approved. Until then, readiness campaign scripts may produce dry-run batches and in-app/dashboard surface contracts, but they must not write Redis notifications, remote push, email, or Prisma rows.

## Consequences

### Positive

- The current implementation has an explicit retention contract instead of pretending Redis is durable history.
- P0/P1 data closure remains tied to source models and consumer surfaces, not notification side effects.
- Readiness campaigns can proceed through in-app/dashboard surfaces while live notification copy and consent rules are still under review.
- The live-delivery gate can now prove preference-to-push-token linkage without sending notifications.
- A future Prisma-backed notification history can be introduced only when the product needs durable delivery audit, analytics, legal retention, or user-visible history beyond 30 days.

### Negative

- Users may lose old feed items after Redis expiry, clear-all, or Redis recovery.
- Operators cannot use the current notification feed as a historical proof-of-delivery ledger.
- Live campaign dispatch still needs policy opt-in and an approved non-anonymous recipient workflow before Redis/push/email channels are enabled.

### Neutral

- The notification closure gate should treat `notification_persistence_decision_open` as resolved by this ADR.
- The remaining readiness live-channel blockers are `channel_disabled_by_policy` and `recipient_user_ids_redacted`.
- If durable notification history becomes required, supersede this ADR with a Prisma-backed `NotificationDelivery` or equivalent model and migration plan.
