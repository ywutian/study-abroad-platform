import { Prisma } from '@prisma/client';
import { ProfileReadinessService } from './profile-readiness.service';

describe('ProfileReadinessService', () => {
  let service: ProfileReadinessService;
  let prisma: {
    profile: { findUnique: jest.Mock };
    schoolListItem: { findMany: jest.Mock };
    applicationTimeline: { findMany: jest.Mock };
    resume: { findMany: jest.Mock };
    resumeEvidence: { count: jest.Mock };
    recommendationLetter: { findMany: jest.Mock };
    applicationAnalysisRun: { findFirst: jest.Mock };
    predictionResult: { findMany: jest.Mock };
    schoolDeadline: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      profile: { findUnique: jest.fn() },
      schoolListItem: { findMany: jest.fn() },
      applicationTimeline: { findMany: jest.fn() },
      resume: { findMany: jest.fn() },
      resumeEvidence: { count: jest.fn() },
      recommendationLetter: { findMany: jest.fn() },
      applicationAnalysisRun: { findFirst: jest.fn() },
      predictionResult: { findMany: jest.fn() },
      schoolDeadline: { findMany: jest.fn() },
    };
    service = new ProfileReadinessService(prisma as any);
  });

  function mockCommonData() {
    prisma.schoolListItem.findMany.mockResolvedValue([]);
    prisma.applicationTimeline.findMany.mockResolvedValue([]);
    prisma.resume.findMany.mockResolvedValue([]);
    prisma.resumeEvidence.count.mockResolvedValue(0);
    prisma.recommendationLetter.findMany.mockResolvedValue([]);
    prisma.applicationAnalysisRun.findFirst.mockResolvedValue(null);
    prisma.predictionResult.findMany.mockResolvedValue([]);
    prisma.schoolDeadline.findMany.mockResolvedValue([]);
  }

  function completeProfile(overrides: Record<string, unknown> = {}) {
    return {
      id: 'profile-1',
      userId: 'user-1',
      gpa: new Prisma.Decimal(3.9),
      gpaScale: new Prisma.Decimal(4),
      gpa9: null,
      gpa10: null,
      gpa11: null,
      gpa12: null,
      applyingTestOptional: false,
      testScores: [{ id: 'score-1' }],
      activities: [{ id: 'activity-1' }],
      awards: [{ id: 'award-1' }],
      semesterGpas: [],
      essays: [],
      targetMajor: 'Computer Science',
      intendedMajor: null,
      grade: 'JUNIOR',
      currentSchool: 'Example High',
      visibility: 'PRIVATE',
      nationality: 'CN',
      countryOfResidence: null,
      citizenship: null,
      educationSystem: null,
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  it('returns stable blockers for an empty profile', async () => {
    prisma.profile.findUnique.mockResolvedValue(null);
    mockCommonData();

    const readiness = await service.getReadiness('user-1');

    expect(readiness.readinessVersion).toBe('profile-readiness-v1');
    expect(readiness.profileCompleteness.score).toBe(0);
    expect(readiness.profileCompleteness.gaps).toEqual(
      expect.arrayContaining([
        'profile.gpa_anchor',
        'profile.test_strategy',
        'profile.major',
      ]),
    );
    expect(readiness.overall.blockers).toEqual(
      expect.arrayContaining([
        'profile.gpa_anchor',
        'profile.test_strategy',
        'profile.major',
        'school_list.add_first',
      ]),
    );
    expect(readiness.overall.blockers).not.toContain('school_list.min_count');
    expect(
      readiness.workflowReadiness.items.find(
        (item) => item.key === 'school_list',
      )?.gaps,
    ).toEqual(['school_list.add_first']);
    expect(readiness.overall.canRunPrediction).toBe(false);
    expect(readiness.applicationAnalysis.state).toBe('insufficientProfileData');
  });

  it('treats explicit test optional and grade-level GPA as valid profile signals', async () => {
    prisma.profile.findUnique.mockResolvedValue(
      completeProfile({
        gpa: null,
        gpa11: new Prisma.Decimal(3.85),
        testScores: [],
        applyingTestOptional: true,
      }),
    );
    mockCommonData();

    const readiness = await service.getReadiness('user-1');

    expect(readiness.profileCompleteness.score).toBe(100);
    expect(readiness.profileCompleteness.testStrategy).toBe(
      'test_optional_confirmed',
    );
    expect(readiness.profileCompleteness.gpaAnchor).toEqual({
      value: 3.85,
      scale: 4,
      source: 'grade_level',
    });
    expect(readiness.applicationAnalysis.state).toBe('noTargetSchools');
    expect(readiness.overall.nextActions[0]).toEqual(
      expect.objectContaining({
        key: 'school_list.add_first',
        href: '/schools',
      }),
    );
  });

  it('surfaces stale predictions, missing timeline coverage, and recommendation status counts', async () => {
    const now = Date.now();
    const old = new Date(now - 100 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now - 24 * 60 * 60 * 1000);
    const schools = Array.from({ length: 6 }, (_, index) => ({
      id: `list-${index}`,
      schoolId: `school-${index}`,
      tier: index < 2 ? 'REACH' : index < 4 ? 'TARGET' : 'SAFETY',
      round: 'EA',
      updatedAt: new Date('2026-05-02T00:00:00.000Z'),
    }));

    prisma.profile.findUnique.mockResolvedValue(completeProfile());
    prisma.schoolListItem.findMany.mockResolvedValue(schools);
    prisma.applicationTimeline.findMany.mockResolvedValue([
      {
        schoolId: 'school-0',
        round: 'EA',
        updatedAt: new Date('2026-05-03T00:00:00.000Z'),
        tasks: [{ completed: false, dueDate: yesterday }],
      },
      {
        schoolId: 'school-1',
        round: 'EA',
        updatedAt: new Date('2026-05-03T00:00:00.000Z'),
        tasks: [{ completed: true, dueDate: yesterday }],
      },
    ]);
    prisma.resume.findMany.mockResolvedValue([]);
    prisma.resumeEvidence.count.mockResolvedValue(0);
    prisma.recommendationLetter.findMany.mockResolvedValue([
      {
        status: 'REQUESTED',
        dueDate: yesterday,
        updatedAt: new Date('2026-05-04T00:00:00.000Z'),
      },
      {
        status: 'IN_PROGRESS',
        dueDate: null,
        updatedAt: new Date('2026-05-05T00:00:00.000Z'),
      },
      {
        status: 'SUBMITTED',
        dueDate: yesterday,
        updatedAt: new Date('2026-05-06T00:00:00.000Z'),
      },
      {
        status: 'CONFIRMED',
        dueDate: yesterday,
        updatedAt: new Date('2026-05-07T00:00:00.000Z'),
      },
    ]);
    prisma.applicationAnalysisRun.findFirst.mockResolvedValue(null);
    prisma.predictionResult.findMany.mockResolvedValue(
      schools.map((school) => ({
        schoolId: school.schoolId,
        authority: 'AUTHORITATIVE',
        updatedAt: old,
      })),
    );
    prisma.schoolDeadline.findMany.mockResolvedValue([]);

    const readiness = await service.getReadiness('user-1');

    expect(readiness.schoolList.count).toBe(6);
    expect(readiness.schoolList.balanced).toBe(true);
    expect(readiness.predictionDataSupport.authoritativeCount).toBe(6);
    expect(readiness.predictionDataSupport.freshAuthoritativeCount).toBe(0);
    expect(readiness.predictionDataSupport.staleCount).toBe(6);
    expect(readiness.timeline.coverageCount).toBe(2);
    expect(readiness.timeline.missingTimelineCount).toBe(4);
    expect(readiness.timeline.overdueTaskCount).toBe(1);
    expect(readiness.recommendationLetters).toEqual(
      expect.objectContaining({
        requested: 1,
        inProgress: 1,
        submitted: 1,
        confirmed: 1,
        overdue: 1,
      }),
    );
    expect(readiness.overall.nextActions.map((action) => action.key)).toEqual(
      expect.arrayContaining(['prediction.run', 'timeline.sync']),
    );
  });
});
