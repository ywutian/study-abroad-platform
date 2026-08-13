import { describe, expect, it } from 'vitest';
import type { PersonalEventResponse, TimelineResponse } from '@/types/timeline';
import {
  buildTimelineBoardModel,
  daysUntilDate,
  getArchivedDisplayStatus,
  resolveTimelineTab,
} from './timeline-view-model';

const now = new Date('2026-05-14T12:00:00.000Z');

function school(overrides: Partial<TimelineResponse>): TimelineResponse {
  return {
    id: 'school-1',
    schoolId: 'school-id-1',
    schoolName: 'Princeton University',
    round: 'RD',
    applicationYear: 2026,
    deadline: '2026-06-01T00:00:00.000Z',
    status: 'NOT_STARTED',
    progress: 0,
    priority: 0,
    tasksTotal: 8,
    tasksCompleted: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function personal(overrides: Partial<PersonalEventResponse>): PersonalEventResponse {
  return {
    id: 'event-1',
    category: 'COMPETITION',
    title: 'JpW',
    deadline: '2026-06-01T00:00:00.000Z',
    eventDate: undefined,
    status: 'NOT_STARTED',
    progress: 0,
    priority: 0,
    tasksTotal: 5,
    tasksCompleted: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('timeline view model', () => {
  it('defaults old all tab links to todo', () => {
    expect(resolveTimelineTab(null)).toBe('todo');
    expect(resolveTimelineTab('all')).toBe('todo');
    expect(resolveTimelineTab('school')).toBe('school');
    expect(resolveTimelineTab('personal')).toBe('personal');
    expect(resolveTimelineTab('archive')).toBe('archive');
  });

  it('computes UTC calendar-day distance', () => {
    expect(daysUntilDate('2026-05-14T00:00:00.000Z', now)).toBe(0);
    expect(daysUntilDate('2026-05-15T00:00:00.000Z', now)).toBe(1);
    expect(daysUntilDate('2026-05-13T23:59:00.000Z', now)).toBe(-1);
  });

  it('keeps overdue personal events and existing school timelines out of todo', () => {
    const model = buildTimelineBoardModel(
      [
        school({
          id: 'stale-school',
          schoolName: 'Yale University',
          deadline: '2026-01-01T00:00:00.000Z',
        }),
        school({
          id: 'future-school',
          schoolName: 'Princeton University',
          deadline: '2026-06-01T00:00:00.000Z',
        }),
      ],
      [
        personal({
          id: 'stale-event',
          title: 'Angelina',
          deadline: '2026-03-01T00:00:00.000Z',
        }),
        personal({
          id: 'future-event',
          title: 'SAT',
          deadline: '2026-05-20T00:00:00.000Z',
          priority: 5,
        }),
      ],
      now
    );

    expect(model.todoItems.map((item) => item.id)).toEqual(['future-event', 'future-school']);
    expect(model.archivedTimelines.map((item) => item.id)).toEqual(['stale-school']);
    expect(model.archivedPersonalEvents.map((item) => item.id)).toEqual(['stale-event']);
    expect(model.metrics.overdue).toBe(2);
  });

  it('keeps an upcoming event actionable after its registration deadline passes', () => {
    const model = buildTimelineBoardModel(
      [],
      [
        personal({
          id: 'sat-test-day',
          title: 'SAT',
          deadline: '2026-05-01T00:00:00.000Z',
          eventDate: '2026-06-06T00:00:00.000Z',
        }),
      ],
      now
    );

    expect(model.todoItems.map((item) => item.id)).toEqual(['sat-test-day']);
    expect(model.todoItems[0].date).toBe('2026-06-06T00:00:00.000Z');
    expect(model.archivedPersonalEvents).toEqual([]);
  });

  it('sorts todo by urgency, then date, then priority', () => {
    const model = buildTimelineBoardModel(
      [
        school({
          id: 'later-school',
          deadline: '2026-07-01T00:00:00.000Z',
          priority: 10,
        }),
        school({
          id: 'today-school',
          deadline: '2026-05-14T00:00:00.000Z',
          priority: 0,
        }),
      ],
      [
        personal({
          id: 'week-event',
          deadline: '2026-05-18T00:00:00.000Z',
          priority: 1,
        }),
        personal({
          id: 'month-event',
          deadline: '2026-05-30T00:00:00.000Z',
          priority: 100,
        }),
      ],
      now
    );

    expect(model.todoItems.map((item) => item.id)).toEqual([
      'today-school',
      'week-event',
      'month-event',
      'later-school',
    ]);
    expect(model.metrics.due7).toBe(2);
    expect(model.metrics.due30).toBe(3);
  });

  it('uses overdue as the archive display status for unfinished expired items', () => {
    expect(getArchivedDisplayStatus('NOT_STARTED', -119)).toBe('OVERDUE');
    expect(getArchivedDisplayStatus('IN_PROGRESS', -1)).toBe('OVERDUE');
    expect(getArchivedDisplayStatus('SUBMITTED', -1)).toBe('SUBMITTED');
    expect(getArchivedDisplayStatus('COMPLETED', -1)).toBe('COMPLETED');
  });
});
