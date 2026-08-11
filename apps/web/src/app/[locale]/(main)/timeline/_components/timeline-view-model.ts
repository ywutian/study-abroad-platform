import type { PersonalEventResponse, TabType, TimelineResponse } from '@/types/timeline';
import { resolveApplicationYear } from '@study-abroad/shared';

export type TimelineItemKind = 'school' | 'personal';
export type UrgencyBucket = 'today' | 'week' | 'month' | 'later' | 'undated';
export type ArchiveReason = 'completed' | 'cancelled' | 'overdue';

export interface TimelineBoardItem {
  id: string;
  kind: TimelineItemKind;
  date?: string;
  daysUntil: number | null;
  urgencyBucket: UrgencyBucket;
  priority: number;
}

export interface TimelineBoardModel {
  actionableTimelines: TimelineResponse[];
  actionablePersonalEvents: PersonalEventResponse[];
  archivedTimelines: TimelineResponse[];
  archivedPersonalEvents: PersonalEventResponse[];
  todoItems: TimelineBoardItem[];
  metrics: {
    due7: number;
    due30: number;
    overdue: number;
    incompleteTasks: number;
  };
}

const SCHOOL_ARCHIVE_STATUSES = new Set([
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'WAITLISTED',
  'WITHDRAWN',
]);
const PERSONAL_ARCHIVE_STATUSES = new Set(['COMPLETED', 'CANCELLED']);
const TERMINAL_ARCHIVE_STATUSES = new Set([
  ...SCHOOL_ARCHIVE_STATUSES,
  ...PERSONAL_ARCHIVE_STATUSES,
]);
const DAY_MS = 24 * 60 * 60 * 1000;

export function getCurrentCycleSchoolIds(
  timelines: TimelineResponse[],
  now = new Date()
): Set<string> {
  const applicationYear = resolveApplicationYear(now);
  return new Set(
    timelines
      .filter((timeline) => timeline.applicationYear >= applicationYear)
      .map((timeline) => timeline.schoolId)
  );
}

export function resolveTimelineTab(tab: string | null): TabType {
  if (tab === 'school' || tab === 'personal' || tab === 'archive') return tab;
  return 'todo';
}

export function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function daysUntilDate(dateStr?: string, now = new Date()): number | null {
  if (!dateStr) return null;

  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;

  return Math.ceil((startOfUtcDay(target).getTime() - startOfUtcDay(now).getTime()) / DAY_MS);
}

/** The last meaningful date after which a personal event is truly historical. */
export function getPersonalLifecycleDate(event: {
  deadline?: string;
  eventDate?: string;
}): string | undefined {
  const candidates = [event.deadline, event.eventDate]
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((candidate) => !Number.isNaN(candidate.time))
    .sort((a, b) => b.time - a.time);

  return candidates[0]?.value;
}

/** The next date requiring action; after all dates pass, keep the final date. */
export function getPersonalActionDate(
  event: { deadline?: string; eventDate?: string },
  now = new Date()
): string | undefined {
  const candidates = [event.deadline, event.eventDate]
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, daysUntil: daysUntilDate(value, now) }))
    .filter(
      (candidate): candidate is { value: string; daysUntil: number } => candidate.daysUntil !== null
    );
  const upcoming = candidates
    .filter((candidate) => candidate.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return upcoming[0]?.value ?? getPersonalLifecycleDate(event);
}

export function getArchivedDisplayStatus(status: string, daysUntil: number | null): string {
  if (daysUntil !== null && daysUntil < 0 && !TERMINAL_ARCHIVE_STATUSES.has(status)) {
    return 'OVERDUE';
  }

  return status;
}

function getSchoolEffectiveDeadline(timeline: TimelineResponse): string | undefined {
  return timeline.deadline;
}

function getUrgencyBucket(daysUntil: number | null): UrgencyBucket {
  if (daysUntil === null) return 'undated';
  if (daysUntil <= 0) return 'today';
  if (daysUntil <= 7) return 'week';
  if (daysUntil <= 30) return 'month';
  return 'later';
}

function getUrgencyRank(bucket: UrgencyBucket): number {
  switch (bucket) {
    case 'today':
      return 0;
    case 'week':
      return 1;
    case 'month':
      return 2;
    case 'later':
      return 3;
    case 'undated':
      return 4;
  }
}

function compareActionItems(a: TimelineBoardItem, b: TimelineBoardItem): number {
  const urgencyDiff = getUrgencyRank(a.urgencyBucket) - getUrgencyRank(b.urgencyBucket);
  if (urgencyDiff !== 0) return urgencyDiff;

  if (a.daysUntil !== null && b.daysUntil !== null && a.daysUntil !== b.daysUntil) {
    return a.daysUntil - b.daysUntil;
  }
  if (a.daysUntil !== null && b.daysUntil === null) return -1;
  if (a.daysUntil === null && b.daysUntil !== null) return 1;

  if (a.priority !== b.priority) return b.priority - a.priority;
  if (a.kind !== b.kind) return a.kind === 'personal' ? -1 : 1;
  return a.id.localeCompare(b.id);
}

function compareArchivedByDate(
  a: { deadline?: string; eventDate?: string; createdAt: string; priority: number },
  b: { deadline?: string; eventDate?: string; createdAt: string; priority: number }
): number {
  const aDate = new Date(a.deadline ?? a.eventDate ?? a.createdAt).getTime();
  const bDate = new Date(b.deadline ?? b.eventDate ?? b.createdAt).getTime();
  if (aDate !== bDate) return bDate - aDate;
  return b.priority - a.priority;
}

export function buildTimelineBoardModel(
  timelines: TimelineResponse[],
  personalEvents: PersonalEventResponse[],
  now = new Date()
): TimelineBoardModel {
  const actionableTimelines: TimelineResponse[] = [];
  const archivedTimelines: TimelineResponse[] = [];
  const actionablePersonalEvents: PersonalEventResponse[] = [];
  const archivedPersonalEvents: PersonalEventResponse[] = [];
  const todoItems: TimelineBoardItem[] = [];
  let overdue = 0;

  for (const timeline of timelines) {
    const effectiveDeadline = getSchoolEffectiveDeadline(timeline);
    const daysUntil = daysUntilDate(effectiveDeadline, now);
    const isTerminal = SCHOOL_ARCHIVE_STATUSES.has(timeline.status);
    const isOverdue = daysUntil !== null && daysUntil < 0;
    const displayTimeline =
      effectiveDeadline && effectiveDeadline !== timeline.deadline
        ? { ...timeline, deadline: effectiveDeadline }
        : timeline;

    if (isTerminal || isOverdue) {
      archivedTimelines.push(displayTimeline);
      if (!isTerminal && isOverdue) overdue += 1;
      continue;
    }

    actionableTimelines.push(displayTimeline);
    todoItems.push({
      id: timeline.id,
      kind: 'school',
      date: effectiveDeadline,
      daysUntil,
      urgencyBucket: getUrgencyBucket(daysUntil),
      priority: timeline.priority,
    });
  }

  for (const event of personalEvents) {
    const lifecycleDate = getPersonalLifecycleDate(event);
    const date = getPersonalActionDate(event, now);
    const daysUntil = daysUntilDate(date, now);
    const isTerminal = PERSONAL_ARCHIVE_STATUSES.has(event.status);
    const lifecycleDaysUntil = daysUntilDate(lifecycleDate, now);
    const isOverdue = lifecycleDaysUntil !== null && lifecycleDaysUntil < 0;

    if (isTerminal || isOverdue) {
      archivedPersonalEvents.push(event);
      if (!isTerminal && isOverdue) overdue += 1;
      continue;
    }

    actionablePersonalEvents.push(event);
    todoItems.push({
      id: event.id,
      kind: 'personal',
      date,
      daysUntil,
      urgencyBucket: getUrgencyBucket(daysUntil),
      priority: event.priority,
    });
  }

  todoItems.sort(compareActionItems);
  actionableTimelines.sort((a, b) =>
    compareActionItems(
      todoItems.find((item) => item.kind === 'school' && item.id === a.id) ?? {
        id: a.id,
        kind: 'school',
        daysUntil: daysUntilDate(a.deadline, now),
        urgencyBucket: getUrgencyBucket(daysUntilDate(a.deadline, now)),
        priority: a.priority,
      },
      todoItems.find((item) => item.kind === 'school' && item.id === b.id) ?? {
        id: b.id,
        kind: 'school',
        daysUntil: daysUntilDate(b.deadline, now),
        urgencyBucket: getUrgencyBucket(daysUntilDate(b.deadline, now)),
        priority: b.priority,
      }
    )
  );
  actionablePersonalEvents.sort((a, b) =>
    compareActionItems(
      todoItems.find((item) => item.kind === 'personal' && item.id === a.id) ?? {
        id: a.id,
        kind: 'personal',
        daysUntil: daysUntilDate(a.deadline ?? a.eventDate, now),
        urgencyBucket: getUrgencyBucket(daysUntilDate(a.deadline ?? a.eventDate, now)),
        priority: a.priority,
      },
      todoItems.find((item) => item.kind === 'personal' && item.id === b.id) ?? {
        id: b.id,
        kind: 'personal',
        daysUntil: daysUntilDate(b.deadline ?? b.eventDate, now),
        urgencyBucket: getUrgencyBucket(daysUntilDate(b.deadline ?? b.eventDate, now)),
        priority: b.priority,
      }
    )
  );
  archivedTimelines.sort(compareArchivedByDate);
  archivedPersonalEvents.sort((a, b) => {
    const aDate = new Date(getPersonalLifecycleDate(a) ?? a.createdAt).getTime();
    const bDate = new Date(getPersonalLifecycleDate(b) ?? b.createdAt).getTime();
    if (aDate !== bDate) return bDate - aDate;
    return b.priority - a.priority;
  });

  const due7 = todoItems.filter(
    (item) => item.daysUntil !== null && item.daysUntil >= 0 && item.daysUntil <= 7
  ).length;
  const due30 = todoItems.filter(
    (item) => item.daysUntil !== null && item.daysUntil >= 0 && item.daysUntil <= 30
  ).length;
  const incompleteTasks =
    actionableTimelines.reduce(
      (sum, item) => sum + Math.max(item.tasksTotal - item.tasksCompleted, 0),
      0
    ) +
    actionablePersonalEvents.reduce(
      (sum, item) => sum + Math.max(item.tasksTotal - item.tasksCompleted, 0),
      0
    );

  return {
    actionableTimelines,
    actionablePersonalEvents,
    archivedTimelines,
    archivedPersonalEvents,
    todoItems,
    metrics: {
      due7,
      due30,
      overdue,
      incompleteTasks,
    },
  };
}
