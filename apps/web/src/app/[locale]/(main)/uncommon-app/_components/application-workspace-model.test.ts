import { describe, expect, it } from 'vitest';
import { buildApplicationWorkspaceModel } from './application-workspace-model';
import type { Profile, SchoolListItem } from './types';
import type { TimelineResponse } from '@/types/timeline';

const now = new Date('2026-05-15T12:00:00.000Z');

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'profile-1',
    gpa: 3.9,
    testScores: [{ type: 'SAT', score: 1520 }],
    activities: [{ id: 'activity-1', name: 'Research' }],
    awards: [{ id: 'award-1', name: 'Competition' }],
    ...overrides,
  };
}

function school(overrides: Partial<SchoolListItem> = {}): SchoolListItem {
  return {
    id: overrides.id ?? 'item-1',
    schoolId: overrides.schoolId ?? 'school-1',
    tier: overrides.tier ?? 'TARGET',
    round: overrides.round ?? 'RD',
    school: {
      id: overrides.schoolId ?? 'school-1',
      name: overrides.school?.name ?? 'Example University',
      nameZh: overrides.school?.nameZh,
      usNewsRank: overrides.school?.usNewsRank,
      rankings: overrides.school?.rankings,
      acceptanceRate: overrides.school?.acceptanceRate,
    },
    isAIRecommended: overrides.isAIRecommended ?? false,
    essayPromptCount: overrides.essayPromptCount ?? 0,
    deadlines: overrides.deadlines,
    prediction: overrides.prediction,
  };
}

function timeline(overrides: Partial<TimelineResponse> = {}): TimelineResponse {
  return {
    id: overrides.id ?? 'timeline-1',
    schoolId: overrides.schoolId ?? 'school-1',
    schoolName: overrides.schoolName ?? 'Example University',
    round: overrides.round ?? 'RD',
    deadline: overrides.deadline,
    status: overrides.status ?? 'NOT_STARTED',
    progress: overrides.progress ?? 0,
    priority: overrides.priority ?? 0,
    tasksTotal: overrides.tasksTotal ?? 5,
    tasksCompleted: overrides.tasksCompleted ?? 1,
    createdAt: overrides.createdAt ?? '2026-05-01T00:00:00.000Z',
  };
}

describe('buildApplicationWorkspaceModel', () => {
  it('points empty users toward profile work without hollow KPI emphasis', () => {
    const model = buildApplicationWorkspaceModel({
      profile: null,
      schoolList: [],
      timelines: [],
      now,
    });

    expect(model.profileScore).toBe(0);
    expect(model.schoolCount).toBe(0);
    expect(model.nextAction.id).toBe('complete-profile');
    expect(model.schoolApplications).toEqual([]);
  });

  it('points users with a partial profile and no schools toward the school list', () => {
    const model = buildApplicationWorkspaceModel({
      profile: profile({ activities: [], awards: [] }),
      schoolList: [],
      timelines: [],
      now,
    });

    expect(model.profileScore).toBe(50);
    expect(model.nextAction.id).toBe('add-schools');
  });

  it('flags a reach-only list as needing safer coverage', () => {
    const model = buildApplicationWorkspaceModel({
      profile: profile(),
      schoolList: [
        school({ id: 'item-1', schoolId: 'school-1', tier: 'REACH' }),
        school({ id: 'item-2', schoolId: 'school-2', tier: 'REACH' }),
        school({ id: 'item-3', schoolId: 'school-3', tier: 'REACH' }),
        school({ id: 'item-4', schoolId: 'school-4', tier: 'REACH' }),
        school({ id: 'item-5', schoolId: 'school-5', tier: 'REACH' }),
        school({ id: 'item-6', schoolId: 'school-6', tier: 'REACH' }),
      ],
      timelines: [],
      now,
    });

    expect(model.nextAction.id).toBe('add-safety');
    expect(model.healthChecks.find((check) => check.id === 'balance')?.status).toBe('risk');
  });

  it('shows essay prompt counts and deadline risk on school applications', () => {
    const model = buildApplicationWorkspaceModel({
      profile: profile(),
      schoolList: [
        school({
          essayPromptCount: 3,
          deadlines: [{ round: 'RD', applicationDeadline: '2026-05-20T00:00:00.000Z' }],
        }),
      ],
      timelines: [
        timeline({
          deadline: '2026-05-20T00:00:00.000Z',
          tasksTotal: 6,
          tasksCompleted: 2,
        }),
      ],
      now,
    });

    expect(model.schoolApplications[0]).toMatchObject({
      essayPromptCount: 3,
      daysUntil: 5,
      urgency: 'due7',
      nextStep: 'review-deadlines',
      tasksRemaining: 4,
    });
    expect(model.dueSoonCount).toBe(1);
  });
});
