// Timeline contract — single source of truth across api / web / mobile.
//
// Dates are ISO-8601 **strings** (the wire format): the backend stores Prisma
// `DateTime` and Nest serializes them to strings in the JSON response, so every
// consumer (web/mobile) always receives strings. Do not type these as `Date`.

// ── Enums (string-literal unions; mirror the Prisma enums + the `round` string) ──

// Reuse the canonical shared enums rather than redefining them (the whole point
// of this unification). `ApplicationRound` is already a union; `TaskType` is an
// enum (its string values double as the wire values).
import type { ApplicationRound } from '../constants/application-rounds';
import type { TaskType } from '../constants/enums';

// Status of an application timeline. Same value-set as the legacy
// `ApplicationStatus` enum in `./api`, but a string-literal union so wire
// strings assign/compare without enum friction. (The legacy enum is left for a
// separate reconcile — see the timeline unification Phase 2.)
export type TimelineStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WAITLISTED'
  | 'WITHDRAWN';

export type TaskSourceStatus =
  | 'generic'
  | 'source_backed'
  | 'source_review_required'
  | 'first_party';

export type PersonalEventCategory =
  | 'COMPETITION'
  | 'TEST'
  | 'SUMMER_PROGRAM'
  | 'INTERNSHIP'
  | 'ACTIVITY'
  | 'MATERIAL'
  | 'OTHER';

export type PersonalEventStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type GlobalEventCategory =
  | 'TEST'
  | 'COMPETITION'
  | 'SUMMER_PROGRAM'
  | 'FINANCIAL_AID'
  | 'APPLICATION'
  | 'OTHER';

export const PERSONAL_EVENT_CATEGORIES: readonly PersonalEventCategory[] = [
  'COMPETITION',
  'TEST',
  'SUMMER_PROGRAM',
  'INTERNSHIP',
  'ACTIVITY',
  'MATERIAL',
  'OTHER',
];

// ── Application timeline ──

export interface TimelineResponse {
  id: string;
  schoolId: string;
  schoolName: string;
  round: ApplicationRound;
  deadline?: string;
  status: TimelineStatus;
  progress: number;
  priority: number;
  notes?: string;
  tasksTotal: number;
  tasksCompleted: number;
  createdAt: string;
}

export interface TaskResponse {
  id: string;
  timelineId: string;
  title: string;
  type: TaskType;
  description?: string;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  essayPrompt?: string;
  wordLimit?: number;
  sourceStatus?: TaskSourceStatus;
  sourcePolicy?: string;
  sortOrder: number;
}

export interface TimelineDetail extends TimelineResponse {
  tasks?: TaskResponse[];
}

// ── Personal events ──

export interface PersonalEventResponse {
  id: string;
  category: PersonalEventCategory;
  title: string;
  globalEventId?: string;
  deadline?: string;
  eventDate?: string;
  status: PersonalEventStatus;
  progress: number;
  priority: number;
  description?: string;
  url?: string;
  notes?: string;
  tasksTotal: number;
  tasksCompleted: number;
  createdAt: string;
}

export interface PersonalTaskResponse {
  id: string;
  eventId: string;
  title: string;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  sortOrder: number;
}

export interface PersonalEventDetail extends PersonalEventResponse {
  tasks?: PersonalTaskResponse[];
}

// ── Global events (platform-wide, recurring) ──

export interface GlobalEvent {
  id: string;
  title: string;
  titleZh?: string;
  category: GlobalEventCategory;
  eventDate: string;
  registrationDeadline?: string;
  lateDeadline?: string;
  resultDate?: string;
  description?: string;
  descriptionZh?: string;
  url?: string;
  year: number;
}

// ── Overview / generate ──

export interface TimelineOverview {
  totalSchools: number;
  submitted: number;
  inProgress: number;
  notStarted: number;
  upcomingDeadlines: TimelineResponse[];
  overdueTasks: TaskResponse[];
  totalPersonalEvents: number;
  personalInProgress: number;
  personalCompleted: number;
  upcomingPersonalEvents: PersonalEventResponse[];
}

export interface GenerateTimelineFailedItem {
  schoolId: string;
  reason: 'SCHOOL_NOT_FOUND' | 'ALREADY_EXISTS' | 'INTERNAL_ERROR' | string;
}

export interface GenerateTimelinesResult {
  created: TimelineResponse[];
  failed: GenerateTimelineFailedItem[];
}
