// Timeline types are the canonical shared contract — re-exported here so the
// many `@/types/timeline` imports keep working. Single source of truth lives in
// `packages/shared/src/types/timeline.ts`.
export type {
  TimelineResponse,
  TaskResponse,
  TimelineDetail,
  PersonalEventResponse,
  PersonalTaskResponse,
  PersonalEventDetail,
  GlobalEvent,
  TimelineOverview,
  TimelineStatus,
  ApplicationRound,
  TaskType,
  PersonalEventCategory,
  PersonalEventStatus,
} from '@study-abroad/shared';

import { PERSONAL_EVENT_CATEGORIES, type PersonalEventCategory } from '@study-abroad/shared';

// Web-only UI state — which board tab is active (not part of the API contract).
export type TabType = 'todo' | 'school' | 'personal' | 'archive';

// Kept for backwards-compat with existing imports; aliases the shared list.
export const PERSONAL_CATEGORIES = PERSONAL_EVENT_CATEGORIES;
export type PersonalCategory = PersonalEventCategory;
