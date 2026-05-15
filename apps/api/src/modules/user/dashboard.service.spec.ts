import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: PrismaService;

  const userId = 'user-123';
  const now = new Date('2025-06-15T10:00:00Z');

  const mockUser = {
    email: 'test@example.com',
    role: 'USER',
    points: 120,
    createdAt: now,
  };

  const mockProfile = {
    id: 'profile-1',
    userId,
    targetMajor: 'Computer Science',
    grade: '12',
    gpa: 3.9,
    testScores: [{ id: 'ts-1' }],
    activities: [{ id: 'act-1' }],
    awards: [{ id: 'aw-1' }],
    essays: [{ id: 'es-1' }, { id: 'es-2' }],
  };

  const mockTimelines = [
    {
      id: 'tl-1',
      schoolId: 'school-mit',
      round: 'ED',
      deadline: new Date('2025-11-01T00:00:00Z'),
      schoolName: 'MIT',
      school: { name: 'MIT', nameZh: null },
    },
    {
      id: 'tl-2',
      schoolId: 'school-stanford',
      round: 'RD',
      deadline: new Date('2025-12-15T00:00:00Z'),
      schoolName: 'Stanford',
      school: { name: 'Stanford', nameZh: '斯坦福大学' },
    },
  ];

  const mockPointHistory = [
    {
      action: 'SUBMIT_CASE',
      points: 10,
      createdAt: new Date('2025-06-14T12:00:00Z'),
    },
    {
      action: 'ESSAY_POLISH',
      points: -5,
      createdAt: new Date('2025-06-13T08:00:00Z'),
    },
  ];

  const mockSchoolTierGroups = [
    { tier: 'REACH', _count: { tier: 3 } },
    { tier: 'TARGET', _count: { tier: 4 } },
    { tier: 'SAFETY', _count: { tier: 2 } },
  ];

  const mockPendingTaskTypes = [
    { type: 'ESSAY', _count: { type: 2 } },
    { type: 'DOCUMENT', _count: { type: 1 } },
  ];

  const mockPriorityTasks = [
    {
      id: 'task-1',
      title: 'Submit supplement essay',
      type: 'ESSAY',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      timeline: {
        id: 'tl-1',
        schoolName: 'MIT',
        round: 'ED',
        school: { name: 'MIT', nameZh: null },
      },
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn() },
            profile: { findUnique: jest.fn() },
            follow: { count: jest.fn() },
            admissionCase: { count: jest.fn() },
            predictionResult: { count: jest.fn() },
            applicationTimeline: { findMany: jest.fn() },
            pointHistory: { findMany: jest.fn() },
            schoolListItem: {
              count: jest.fn(),
              findMany: jest.fn(),
              groupBy: jest.fn(),
            },
            applicationTask: {
              count: jest.fn(),
              groupBy: jest.fn(),
              findMany: jest.fn(),
            },
            personalEvent: { findMany: jest.fn() },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper to set up all default mocks for a full dashboard call.
   * Individual tests can override specific mocks after calling this.
   */
  function setupDefaultMocks() {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockProfile);
    (prisma.$transaction as jest.Mock).mockResolvedValue([5, 3]);
    (prisma.admissionCase.count as jest.Mock).mockResolvedValue(7);
    (prisma.predictionResult.count as jest.Mock).mockResolvedValue(4);
    (prisma.applicationTimeline.findMany as jest.Mock).mockResolvedValue(
      mockTimelines,
    );
    (prisma.pointHistory.findMany as jest.Mock).mockResolvedValue(
      mockPointHistory,
    );
    (prisma.schoolListItem.count as jest.Mock).mockResolvedValue(9);
    (prisma.schoolListItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.schoolListItem.groupBy as jest.Mock).mockResolvedValue(
      mockSchoolTierGroups,
    );
    (prisma.applicationTask.count as jest.Mock).mockImplementation(
      ({ where }) => (where?.dueDate?.lt ? 1 : 3),
    );
    (prisma.applicationTask.groupBy as jest.Mock).mockResolvedValue(
      mockPendingTaskTypes,
    );
    (prisma.applicationTask.findMany as jest.Mock).mockResolvedValue(
      mockPriorityTasks,
    );
    (prisma.personalEvent.findMany as jest.Mock).mockResolvedValue([]);
  }

  describe('getDashboardSummary', () => {
    it('should return a full dashboard summary with all data', async () => {
      setupDefaultMocks();

      const result = await service.getDashboardSummary(userId);

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.role).toBe('USER');
      expect(result.user.points).toBe(120);
      expect(result.user.createdAt).toBe(now.toISOString());

      expect(result.profile.completeness).toBe(100);
      expect(result.profile.hasTestScores).toBe(true);
      expect(result.profile.hasActivities).toBe(true);
      expect(result.profile.hasAwards).toBe(true);
      expect(result.profile.targetSchoolCount).toBe(9);
      expect(result.profile.essayCount).toBe(2);

      expect(result.stats.followers).toBe(5);
      expect(result.stats.following).toBe(3);
      expect(result.stats.cases).toBe(7);
      expect(result.stats.predictions).toBe(4);

      expect(result.pendingTasks.total).toBe(3);
      expect(result.pendingTasks.byType).toEqual([
        { type: 'ESSAY', count: 2 },
        { type: 'DOCUMENT', count: 1 },
      ]);
      expect(result.pendingTasks.profileGaps).toEqual([]);

      expect(result.upcomingDeadlines).toHaveLength(2);
      expect(result.recentActivity).toHaveLength(2);
      expect(result.workbench.readiness.score).toBeGreaterThan(70);
      expect(result.workbench.metrics.overdueTasks).toBe(1);
      expect(result.workbench.priorityQueue).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'timeline-task',
            severity: 'warning',
          }),
        ]),
      );
      expect(result.workbench.deadlineStream).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'task-1',
            type: 'task',
            severity: 'warning',
          }),
        ]),
      );
    });

    it('should return defaults when user is not found', async () => {
      setupDefaultMocks();
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getDashboardSummary(userId);

      expect(result.user.email).toBe('');
      expect(result.user.role).toBe('USER');
      expect(result.user.points).toBe(0);
      expect(result.user.createdAt).toBe('');
    });

    it('should return 0 completeness and all gaps when no profile exists', async () => {
      setupDefaultMocks();
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getDashboardSummary(userId);

      expect(result.profile.completeness).toBe(0);
      expect(result.pendingTasks.profileGaps).toEqual([
        'basicInfo',
        'gpa',
        'testScores',
        'activities',
        'awards',
        'targetSchools',
      ]);
      expect(result.profile.hasTestScores).toBe(false);
      expect(result.profile.hasActivities).toBe(false);
      expect(result.profile.hasAwards).toBe(false);
      expect(result.profile.essayCount).toBe(0);
    });

    it('should calculate completeness correctly with a partial profile', async () => {
      setupDefaultMocks();
      // Profile with basicInfo (targetMajor) + testScores but no gpa, no activities, no awards
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        targetMajor: 'CS',
        grade: null,
        gpa: null,
        testScores: [{ id: 'ts-1' }],
        activities: [],
        awards: [],
        essays: [],
      });
      // No school list items => targetSchools gap
      (prisma.schoolListItem.count as jest.Mock).mockResolvedValue(0);

      const result = await service.getDashboardSummary(userId);

      // basicInfo (20) + testScores (15) = 35
      expect(result.profile.completeness).toBe(35);
      expect(result.pendingTasks.profileGaps).toEqual(
        expect.arrayContaining([
          'gpa',
          'activities',
          'awards',
          'targetSchools',
        ]),
      );
      expect(result.pendingTasks.profileGaps).not.toContain('basicInfo');
      expect(result.pendingTasks.profileGaps).not.toContain('testScores');
    });

    it('should redistribute testScores weight to gpa when applyingTestOptional is true', async () => {
      setupDefaultMocks();
      // Test-optional applicant with GPA but no test scores
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        targetMajor: 'CS',
        grade: '12',
        gpa: 3.9,
        applyingTestOptional: true,
        testScores: [],
        activities: [{ id: 'a1' }],
        awards: [{ id: 'aw-1' }],
        essays: [],
      });
      (prisma.schoolListItem.count as jest.Mock).mockResolvedValue(5);

      const result = await service.getDashboardSummary(userId);

      // basicInfo (20) + gpa (35, redistributed) + activities (20) + awards (10) + targetSchools (10) = 95
      // testScores is not counted (weight=0) and not in gaps
      expect(result.profile.completeness).toBe(95);
      expect(result.pendingTasks.profileGaps).not.toContain('testScores');
    });

    it('should return 100% completeness with all profile data present', async () => {
      setupDefaultMocks();

      const result = await service.getDashboardSummary(userId);

      // mockProfile has targetMajor+grade(20), testScores(25), gpa(15), activities(20), awards(10)
      // schoolListCount=9 => targetSchools(10) = 100
      expect(result.profile.completeness).toBe(100);
      expect(result.pendingTasks.profileGaps).toEqual([]);
    });

    it('should identify correct profileGaps for missing areas', async () => {
      setupDefaultMocks();
      // Profile with only gpa set (via grade for basicInfo)
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        targetMajor: null,
        grade: '11',
        gpa: 3.5,
        testScores: [],
        activities: [],
        awards: [{ id: 'aw-1' }],
        essays: [],
      });
      (prisma.schoolListItem.count as jest.Mock).mockResolvedValue(2);

      const result = await service.getDashboardSummary(userId);

      // basicInfo (20) + gpa (25) + awards (10) + targetSchools (10) = 65
      // testScores and activities missing → gaps
      expect(result.profile.completeness).toBe(65);
      expect(result.pendingTasks.profileGaps).toEqual([
        'testScores',
        'activities',
      ]);
    });

    it('should build schoolTiers from groupBy results', async () => {
      setupDefaultMocks();

      const result = await service.getDashboardSummary(userId);

      expect(result.profile.schoolTiers).toEqual({
        reach: 3,
        target: 4,
        safety: 2,
      });
    });

    it('should default missing schoolTier categories to 0', async () => {
      setupDefaultMocks();
      // Only REACH returned from groupBy
      (prisma.schoolListItem.groupBy as jest.Mock).mockResolvedValue([
        { tier: 'REACH', _count: { tier: 5 } },
      ]);

      const result = await service.getDashboardSummary(userId);

      expect(result.profile.schoolTiers).toEqual({
        reach: 5,
        target: 0,
        safety: 0,
      });
    });

    it('should format upcomingDeadlines correctly with daysLeft', async () => {
      setupDefaultMocks();
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days ahead
      (prisma.applicationTimeline.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'tl-10',
          round: 'EA',
          deadline: futureDate,
          school: { name: 'Harvard', nameZh: '哈佛大学' },
        },
      ]);

      const result = await service.getDashboardSummary(userId);

      expect(result.upcomingDeadlines).toHaveLength(1);
      expect(result.upcomingDeadlines[0].id).toBe('tl-10');
      expect(result.upcomingDeadlines[0].schoolName).toBe('哈佛大学');
      expect(result.upcomingDeadlines[0].round).toBe('EA');
      expect(result.upcomingDeadlines[0].deadline).toBe(
        futureDate.toISOString(),
      );
      expect(result.upcomingDeadlines[0].daysLeft).toBe(10);
    });

    it('should use English name when nameZh is null', async () => {
      setupDefaultMocks();
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      (prisma.applicationTimeline.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'tl-20',
          round: 'RD',
          deadline: futureDate,
          school: { name: 'MIT', nameZh: null },
        },
      ]);

      const result = await service.getDashboardSummary(userId);

      expect(result.upcomingDeadlines[0].schoolName).toBe('MIT');
    });

    it('should build recentActivity from pointHistory with earn type', async () => {
      setupDefaultMocks();
      const ts = new Date('2025-06-14T12:00:00Z');
      (prisma.pointHistory.findMany as jest.Mock).mockResolvedValue([
        { action: 'SUBMIT_CASE', points: 10, createdAt: ts },
      ]);

      const result = await service.getDashboardSummary(userId);

      expect(result.recentActivity).toHaveLength(1);
      expect(result.recentActivity[0].type).toBe('earn');
      expect(result.recentActivity[0].title).toBe('提交案例');
      expect(result.recentActivity[0].description).toContain('10 积分');
      expect(result.recentActivity[0].createdAt).toBe(ts.toISOString());
    });

    it('should build recentActivity for spend type (negative points)', async () => {
      setupDefaultMocks();
      const ts = new Date('2025-06-13T08:00:00Z');
      (prisma.pointHistory.findMany as jest.Mock).mockResolvedValue([
        { action: 'AI_ESSAY_POLISH', points: -5, createdAt: ts },
      ]);

      const result = await service.getDashboardSummary(userId);

      expect(result.recentActivity).toHaveLength(1);
      expect(result.recentActivity[0].type).toBe('spend');
      expect(result.recentActivity[0].title).toBe('文书润色');
      expect(result.recentActivity[0].description).toContain('消耗 5 积分');
    });

    it('should handle empty timelines gracefully', async () => {
      setupDefaultMocks();
      (prisma.applicationTimeline.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getDashboardSummary(userId);

      expect(result.upcomingDeadlines).toEqual([]);
    });

    it('should filter out timelines with null deadlines', async () => {
      setupDefaultMocks();
      (prisma.applicationTimeline.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'tl-null',
          round: 'ED',
          deadline: null,
          school: { name: 'Caltech', nameZh: null },
        },
        {
          id: 'tl-valid',
          round: 'RD',
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          school: { name: 'Yale', nameZh: '耶鲁大学' },
        },
      ]);

      const result = await service.getDashboardSummary(userId);

      expect(result.upcomingDeadlines).toHaveLength(1);
      expect(result.upcomingDeadlines[0].id).toBe('tl-valid');
    });

    it('should roll stale school-list deadlines forward to the next annual cycle', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-14T00:00:00Z'));
      setupDefaultMocks();
      (prisma.applicationTimeline.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.schoolListItem.findMany as jest.Mock).mockResolvedValue([
        {
          schoolId: 'school-1',
          round: 'RD',
          school: {
            name: 'MIT',
            nameZh: null,
            deadlines: [
              {
                id: 'deadline-2026-rd',
                year: 2026,
                round: 'RD',
                applicationDeadline: new Date('2026-01-05T00:00:00.000Z'),
              },
            ],
          },
        },
      ]);

      try {
        const result = await service.getDashboardSummary(userId, 'en');
        const expectedDeadline = new Date('2027-01-05T00:00:00.000Z');

        expect(result.upcomingDeadlines).toHaveLength(1);
        expect(result.upcomingDeadlines[0]).toMatchObject({
          id: 'deadline-2026-rd',
          schoolName: 'MIT',
          round: 'RD',
          deadline: expectedDeadline.toISOString(),
          daysLeft: Math.ceil(
            (expectedDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          ),
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it('should return correct follow stats from $transaction', async () => {
      setupDefaultMocks();
      (prisma.$transaction as jest.Mock).mockResolvedValue([42, 18]);

      const result = await service.getDashboardSummary(userId);

      expect(result.stats.followers).toBe(42);
      expect(result.stats.following).toBe(18);
    });

    it('should build recentActivity for SWIPE_CORRECT', async () => {
      setupDefaultMocks();
      const ts = new Date('2025-06-14T10:00:00Z');
      (prisma.pointHistory.findMany as jest.Mock).mockResolvedValue([
        { action: 'SWIPE_CORRECT', points: 7, createdAt: ts },
      ]);

      const result = await service.getDashboardSummary(userId);

      expect(result.recentActivity).toHaveLength(1);
      expect(result.recentActivity[0].title).toBe('预测正确');
      expect(result.recentActivity[0].description).toContain('获得 7 积分');
    });

    it('should handle unknown point actions gracefully', async () => {
      setupDefaultMocks();
      const ts = new Date('2025-06-12T06:00:00Z');
      (prisma.pointHistory.findMany as jest.Mock).mockResolvedValue([
        { action: 'UNKNOWN_ACTION', points: 3, createdAt: ts },
      ]);

      const result = await service.getDashboardSummary(userId);

      expect(result.recentActivity).toHaveLength(1);
      expect(result.recentActivity[0].title).toBe('UNKNOWN_ACTION');
      expect(result.recentActivity[0].type).toBe('earn');
    });
  });
});
