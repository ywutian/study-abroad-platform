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
            applicationTimeline: { findMany: jest.fn(), groupBy: jest.fn() },
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
            // 2026-05 Phase 2c: dashboard now also queries
            // EssayAIResult for the <DashboardEssayCoach /> surface.
            essayAIResult: { findFirst: jest.fn() },
            // 2026-05 Phase 2b: dashboard now also queries 4 new
            // sources for the Hub `signals` field (assessment results,
            // recommendation count, verification status, raw chat
            // unread SQL).
            assessmentResult: { findMany: jest.fn() },
            schoolRecommendation: { count: jest.fn() },
            verificationRequest: { findFirst: jest.fn() },
            $queryRaw: jest.fn(),
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
    // applicationTimeline.findMany is called twice: once for upcoming
    // deadlines (status notIn [...decided]) and once for recent decisions
    // (status in [...decided]). Discriminate by where.status shape so
    // tests don't accidentally feed deadline rows to the decisions query.
    mockApplicationTimelineFindMany({
      upcomingDeadlines: mockTimelines,
      recentDecisions: [],
    });
    // Default: no schools past IN_PROGRESS, so PipelineStrip stays hidden.
    (prisma.applicationTimeline.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.pointHistory.findMany as jest.Mock).mockResolvedValue(
      mockPointHistory,
    );
    (prisma.schoolListItem.count as jest.Mock).mockResolvedValue(9);
    // 2026-05 Phase 1 Bug 3: dashboard.service now derives userSchoolIds
    // from schoolListItem.findMany to filter orphan predictions. Mock 9
    // items to match the count so the default "full data" assertions
    // (stats.predictions = 4) still pass.
    (prisma.schoolListItem.findMany as jest.Mock).mockResolvedValue(
      Array.from({ length: 9 }, (_, i) => ({
        schoolId: `school-${i + 1}`,
        round: 'RD',
        school: { name: `School ${i + 1}`, nameZh: null, deadlines: [] },
      })),
    );
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
    // 2026-05 Phase 2c: default to "no AI feedback yet" so dashboard
    // empty-state assertions still pass.
    (prisma.essayAIResult.findFirst as jest.Mock).mockResolvedValue(null);
    // 2026-05 Phase 2b: default to "no signals data yet"
    (prisma.assessmentResult.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.schoolRecommendation.count as jest.Mock).mockResolvedValue(0);
    (prisma.verificationRequest.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ count: 0n }]);
  }

  /**
   * Helper: mock the two distinct applicationTimeline.findMany call
   * sites correctly. Without this, tests that override findMany would
   * accidentally feed upcoming-deadline rows to the recent-decisions
   * query (or vice versa), causing nonsensical mapper output.
   */
  function mockApplicationTimelineFindMany(rows: {
    upcomingDeadlines: unknown[];
    recentDecisions: unknown[];
  }) {
    (prisma.applicationTimeline.findMany as jest.Mock).mockImplementation(
      (args: { where?: { status?: { notIn?: unknown; in?: unknown } } }) => {
        if (args?.where?.status && 'in' in args.where.status) {
          return Promise.resolve(rows.recentDecisions);
        }
        return Promise.resolve(rows.upcomingDeadlines);
      },
    );
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
      expect(result.pendingTasks.todayCount).toBe(1);
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
      mockApplicationTimelineFindMany({
        upcomingDeadlines: [
          {
            id: 'tl-10',
            round: 'EA',
            deadline: futureDate,
            school: { name: 'Harvard', nameZh: '哈佛大学' },
          },
        ],
        recentDecisions: [],
      });

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
      mockApplicationTimelineFindMany({
        upcomingDeadlines: [
          {
            id: 'tl-20',
            round: 'RD',
            deadline: futureDate,
            school: { name: 'MIT', nameZh: null },
          },
        ],
        recentDecisions: [],
      });

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
      mockApplicationTimelineFindMany({
        upcomingDeadlines: [],
        recentDecisions: [],
      });

      const result = await service.getDashboardSummary(userId);

      expect(result.upcomingDeadlines).toEqual([]);
    });

    it('should filter out timelines with null deadlines', async () => {
      setupDefaultMocks();
      mockApplicationTimelineFindMany({
        upcomingDeadlines: [
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
        ],
        recentDecisions: [],
      });

      const result = await service.getDashboardSummary(userId);

      expect(result.upcomingDeadlines).toHaveLength(1);
      expect(result.upcomingDeadlines[0].id).toBe('tl-valid');
    });

    it('should roll stale school-list deadlines forward to the next annual cycle', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-14T00:00:00Z'));
      setupDefaultMocks();
      mockApplicationTimelineFindMany({
        upcomingDeadlines: [],
        recentDecisions: [],
      });
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

    // 2026-05 dashboard redesign batch 4: synthetic `prep` prerequisite rows.
    it('derives synthetic prerequisite rows from a school deadline', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-14T00:00:00Z'));
      setupDefaultMocks();
      mockApplicationTimelineFindMany({
        upcomingDeadlines: [],
        recentDecisions: [],
      });
      (prisma.schoolListItem.findMany as jest.Mock).mockResolvedValue([
        {
          schoolId: 'school-1',
          round: 'RD',
          school: {
            name: 'MIT',
            nameZh: null,
            deadlines: [
              {
                id: 'deadline-far',
                year: 2026,
                round: 'RD',
                // 60 days past the fake "now"
                applicationDeadline: new Date('2026-07-13T00:00:00.000Z'),
              },
            ],
          },
        },
      ]);

      try {
        const result = await service.getDashboardSummary(userId, 'en');
        const prepRows = result.workbench.deadlineStream.filter(
          (d) => d.type === 'prep',
        );
        expect(prepRows.map((r) => r.id).sort()).toEqual([
          'prep-rec-deadline-far',
          'prep-score-deadline-far',
        ]);
        const rec = prepRows.find((r) => r.id === 'prep-rec-deadline-far');
        const score = prepRows.find((r) => r.id === 'prep-score-deadline-far');
        // recommender row: 6 weeks (42d) before a 60-day-out deadline
        expect(rec?.daysLeft).toBe(18);
        // score-send row: 3 weeks (21d) before
        expect(score?.daysLeft).toBe(39);
        expect(rec?.href).toBe('/timeline');
        expect(rec?.title).toContain('MIT');
      } finally {
        jest.useRealTimers();
      }
    });

    it('suppresses prerequisite rows once the lead-time window has closed', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-14T00:00:00Z'));
      setupDefaultMocks();
      mockApplicationTimelineFindMany({
        upcomingDeadlines: [],
        recentDecisions: [],
      });
      (prisma.schoolListItem.findMany as jest.Mock).mockResolvedValue([
        {
          schoolId: 'school-1',
          round: 'RD',
          school: {
            name: 'MIT',
            nameZh: null,
            deadlines: [
              {
                id: 'deadline-near',
                year: 2026,
                round: 'RD',
                // only 10 days out — both the 42d and 21d prep windows
                // have already closed, so no synthetic rows are emitted
                applicationDeadline: new Date('2026-05-24T00:00:00.000Z'),
              },
            ],
          },
        },
      ]);

      try {
        const result = await service.getDashboardSummary(userId, 'en');
        const prepRows = result.workbench.deadlineStream.filter(
          (d) => d.type === 'prep',
        );
        expect(prepRows).toEqual([]);
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

    // 2026-05: Application pipeline — close lifecycle stage F+G gap
    // where dashboard had no awareness of submitted/decided schools.
    it('aggregates ApplicationTimeline groupBy into the workbench pipeline', async () => {
      setupDefaultMocks();
      (prisma.applicationTimeline.groupBy as jest.Mock).mockResolvedValue([
        { status: 'NOT_STARTED', _count: { status: 2 } },
        { status: 'IN_PROGRESS', _count: { status: 4 } },
        { status: 'SUBMITTED', _count: { status: 3 } },
        { status: 'ACCEPTED', _count: { status: 1 } },
        { status: 'WAITLISTED', _count: { status: 1 } },
      ]);

      const result = await service.getDashboardSummary(userId);

      expect(result.workbench.pipeline).toEqual({
        notStarted: 2,
        inProgress: 4,
        submitted: 3,
        accepted: 1,
        rejected: 0,
        waitlisted: 1,
        withdrawn: 0,
        recentDecisions: [],
      });
    });

    it('returns all-zero pipeline when groupBy returns nothing', async () => {
      setupDefaultMocks();
      const result = await service.getDashboardSummary(userId);
      expect(result.workbench.pipeline).toEqual({
        notStarted: 0,
        inProgress: 0,
        submitted: 0,
        accepted: 0,
        rejected: 0,
        waitlisted: 0,
        withdrawn: 0,
        recentDecisions: [],
      });
    });

    // 2026-05: PipelineStrip surfaces per-school decision rows so users
    // see WHICH schools they've heard back from, not just opaque counts.
    it('maps recentDecisions with school name + round + status + decidedAt', async () => {
      setupDefaultMocks();
      const decidedAt = new Date('2026-05-10T14:30:00Z');
      mockApplicationTimelineFindMany({
        upcomingDeadlines: [],
        recentDecisions: [
          {
            id: 'decision-1',
            schoolId: 'sch-stanford',
            schoolName: 'Stanford University',
            round: 'EA',
            status: 'ACCEPTED',
            updatedAt: decidedAt,
            school: { name: 'Stanford University', nameZh: '斯坦福大学' },
          },
          {
            id: 'decision-2',
            schoolId: 'sch-mit',
            schoolName: 'MIT',
            round: 'EA',
            status: 'WAITLISTED',
            updatedAt: decidedAt,
            school: { name: 'MIT', nameZh: null },
          },
        ],
      });

      const result = await service.getDashboardSummary(userId);
      expect(result.workbench.pipeline?.recentDecisions).toEqual([
        {
          id: 'decision-1',
          schoolId: 'sch-stanford',
          schoolName: '斯坦福大学', // zh locale default
          round: 'EA',
          status: 'ACCEPTED',
          decidedAt: decidedAt.toISOString(),
        },
        {
          id: 'decision-2',
          schoolId: 'sch-mit',
          schoolName: 'MIT',
          round: 'EA',
          status: 'WAITLISTED',
          decidedAt: decidedAt.toISOString(),
        },
      ]);
    });

    // 2026-05 Phase 1 Bug 3: validate orphan-prediction filtering.
    // Reproduces the production "105 predictions + 0 schools" bug:
    // when a user removes schools after running predictions, the raw
    // PredictionResult.count is stale. dashboard.stats.predictions
    // must reflect only predictions whose schoolId is still in the
    // user's SchoolListItem.
    it('Phase 1 Bug 3: stats.predictions excludes orphan predictions', async () => {
      setupDefaultMocks();
      // User has 0 schools (removed all after running predictions)
      (prisma.schoolListItem.count as jest.Mock).mockResolvedValue(0);
      (prisma.schoolListItem.findMany as jest.Mock).mockResolvedValue([]);
      // But 105 raw prediction records exist (history from when they had schools)
      (prisma.predictionResult.count as jest.Mock).mockResolvedValue(105);

      const result = await service.getDashboardSummary(userId);
      // ✓ valid count = 0 (no schools in current list → no valid predictions)
      expect(result.stats.predictions).toBe(0);
    });

    // 2026-05 Phase 2c: essayCoach defaults to null when there are no
    // AI runs yet, and renders nothing on the dashboard.
    it('Phase 2c: essayCoach is null when the user has no AI runs', async () => {
      setupDefaultMocks();
      const result = await service.getDashboardSummary(userId);
      expect(result.essayCoach).toBeNull();
    });

    // 2026-05 Phase 2c: essayCoach picks the latest AI result and
    // extracts the first suggestion (review type).
    it('Phase 2c: essayCoach maps review result with first suggestion', async () => {
      setupDefaultMocks();
      const ts = new Date('2026-05-10T14:30:00Z');
      (prisma.essayAIResult.findFirst as jest.Mock).mockResolvedValue({
        type: 'review',
        suggestions: [
          'Strengthen the second paragraph with a concrete example.',
          'Tighten the conclusion.',
        ],
        createdAt: ts,
        essay: { id: 'essay-stanford-why', title: 'Stanford Why Major' },
      });

      const result = await service.getDashboardSummary(userId);
      expect(result.essayCoach).toEqual({
        essayId: 'essay-stanford-why',
        essayTitle: 'Stanford Why Major',
        type: 'review',
        suggestion: 'Strengthen the second paragraph with a concrete example.',
        createdAt: ts.toISOString(),
      });
    });

    // 2026-05 Phase 2c: polish-type results have no suggestions JSON
    // (Polish stores `changes`, not suggestions). The UI falls back to
    // a generic prompt in that case.
    it('Phase 2c: essayCoach polish result has null suggestion', async () => {
      setupDefaultMocks();
      const ts = new Date('2026-05-12T10:00:00Z');
      (prisma.essayAIResult.findFirst as jest.Mock).mockResolvedValue({
        type: 'polish',
        suggestions: null,
        createdAt: ts,
        essay: { id: 'essay-mit-cs', title: 'MIT CS Activity' },
      });

      const result = await service.getDashboardSummary(userId);
      expect(result.essayCoach).toEqual({
        essayId: 'essay-mit-cs',
        essayTitle: 'MIT CS Activity',
        type: 'polish',
        suggestion: null,
        createdAt: ts.toISOString(),
      });
    });

    // 2026-05 Phase 2b: signals default to "nothing yet" state for
    // brand-new users so the Hub can render conservative empty tiles.
    it('Phase 2b: signals default to empty state for new users', async () => {
      setupDefaultMocks();
      const result = await service.getDashboardSummary(userId);
      expect(result.signals).toEqual({
        assessment: { mbti: null, holland: null, completedAt: null },
        recommendationCount: 0,
        verificationStatus: 'unverified',
        chatUnread: 0,
      });
    });

    // 2026-05 Phase 2b: when the user has completed MBTI + Holland,
    // signals.assessment surfaces both codes for the Hub.
    it('Phase 2b: signals.assessment surfaces latest MBTI + Holland codes', async () => {
      setupDefaultMocks();
      const completedAt = new Date('2026-05-10T12:00:00Z');
      (prisma.assessmentResult.findMany as jest.Mock).mockResolvedValue([
        {
          result: { code: 'INTJ', confidence: 0.92 },
          completedAt,
          assessment: { type: 'MBTI' },
        },
        {
          result: { code: 'RIA' },
          completedAt,
          assessment: { type: 'HOLLAND' },
        },
      ]);

      const result = await service.getDashboardSummary(userId);
      expect(result.signals?.assessment).toEqual({
        mbti: 'INTJ',
        holland: 'RIA',
        completedAt: completedAt.toISOString(),
      });
    });

    // 2026-05 Phase 2b: verification status maps Prisma enum to
    // user-facing tristate (unverified/pending/verified).
    it('Phase 2b: verification status maps APPROVED → verified', async () => {
      setupDefaultMocks();
      (prisma.verificationRequest.findFirst as jest.Mock).mockResolvedValue({
        status: 'APPROVED',
      });
      const result = await service.getDashboardSummary(userId);
      expect(result.signals?.verificationStatus).toBe('verified');
    });

    it('Phase 2b: verification status maps PENDING → pending', async () => {
      setupDefaultMocks();
      (prisma.verificationRequest.findFirst as jest.Mock).mockResolvedValue({
        status: 'PENDING',
      });
      const result = await service.getDashboardSummary(userId);
      expect(result.signals?.verificationStatus).toBe('pending');
    });

    it('Phase 2b: verification status maps REJECTED → unverified', async () => {
      setupDefaultMocks();
      (prisma.verificationRequest.findFirst as jest.Mock).mockResolvedValue({
        status: 'REJECTED',
      });
      const result = await service.getDashboardSummary(userId);
      expect(result.signals?.verificationStatus).toBe('unverified');
    });

    // 2026-05 Phase 2b: chat unread comes from raw SQL — verify the
    // bigint count returned by Prisma is coerced to a JS number.
    it('Phase 2b: chatUnread coerces Prisma BigInt count to number', async () => {
      setupDefaultMocks();
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ count: 7n }]);
      const result = await service.getDashboardSummary(userId);
      expect(result.signals?.chatUnread).toBe(7);
    });

    // 2026-05 Phase 1 Bug 4: validate timeline vacuous-truth defense.
    // When schoolCount=0, missingTimelineCount===0 is vacuously true
    // (no schools means no missing timelines). The old code awarded
    // a perfect 10/10 ready — confusing users into thinking they had
    // completed planning. Now: schoolListCount===0 → timeline blocked.
    it('Phase 1 Bug 4: timeline status is blocked when schoolListCount=0', async () => {
      setupDefaultMocks();
      (prisma.schoolListItem.count as jest.Mock).mockResolvedValue(0);
      (prisma.schoolListItem.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.applicationTask.count as jest.Mock).mockResolvedValue(0);

      const result = await service.getDashboardSummary(userId);
      const timelineItem = result.workbench.readiness.items.find(
        (item) => item.key === 'timeline',
      );
      expect(timelineItem?.status).toBe('blocked');
      expect(timelineItem?.value).toBe('0/10');
    });

    // 2026-05 Phase 1.5 #15: A single transient sub-query failure must
    // NOT bring down the whole dashboard. Before the safe() wrapper, ANY
    // sub-query rejection meant Promise.all rejected → AllExceptionsFilter
    // → HTTP 500 → user sees a blank page. After the wrapper, that one
    // sub-query falls back to a sensible default and the rest of the
    // dashboard renders normally.
    it('Phase 1.5 #15: degrades gracefully when one sub-query throws', async () => {
      setupDefaultMocks();
      // Inject a transient failure on the recommendation count query
      // (chosen because its result feeds the Hub Stats column — failure
      // there should NOT break the entire dashboard).
      (prisma.schoolRecommendation.count as jest.Mock).mockRejectedValueOnce(
        new Error('simulated DB blip'),
      );

      // Should NOT throw — the safe() wrapper catches and falls back.
      const result = await service.getDashboardSummary(userId);

      // The broken query's fallback (0) flows through to the signal.
      expect(result.signals?.recommendationCount).toBe(0);
      // The rest of the dashboard renders normally — other counts come
      // from their (unaffected) mock values.
      expect(result.profile).toBeDefined();
      expect(result.workbench).toBeDefined();
    });

    it('Phase 1.5 #15: degrades gracefully when multiple sub-queries throw', async () => {
      setupDefaultMocks();
      (prisma.schoolRecommendation.count as jest.Mock).mockRejectedValueOnce(
        new Error('blip 1'),
      );
      (prisma.assessmentResult.findMany as jest.Mock).mockRejectedValueOnce(
        new Error('blip 2'),
      );
      (prisma.verificationRequest.findFirst as jest.Mock).mockRejectedValueOnce(
        new Error('blip 3'),
      );

      const result = await service.getDashboardSummary(userId);

      // All three failed signals fall back; rest of dashboard intact.
      expect(result.signals?.recommendationCount).toBe(0);
      expect(result.signals?.assessment.mbti).toBeNull();
      expect(result.signals?.verificationStatus).toBe('unverified');
      expect(result.profile).toBeDefined();
    });

    // 2026-05 Phase 2.7 #31: quickAskSuggestions personalization.
    // When the user has no targetMajor and no schools in their list,
    // the chips should be the generic defaults that match the
    // hardcoded i18n fallbacks (so brand-new users see what they always have).
    it('Phase 2.7 #31: quickAskSuggestions falls back to generic defaults for empty profile', async () => {
      setupDefaultMocks();
      (prisma.profile.findUnique as jest.Mock).mockResolvedValueOnce({
        nickname: null,
        grade: null,
        targetMajor: null,
        testScores: [],
        activities: [],
        awards: [],
        education: [],
        essays: [],
      });
      (prisma.schoolListItem.findMany as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.getDashboardSummary(userId, 'zh');

      expect(result.quickAskSuggestions).toEqual([
        '我有多大概率被 MIT 录取？',
        '帮我头脑风暴一篇 Common App 文书',
        '为我推荐 5 所 CS 冲刺校',
      ]);
    });

    it('Phase 2.7 #31: quickAskSuggestions personalizes by targetMajor + first school', async () => {
      setupDefaultMocks();
      (prisma.profile.findUnique as jest.Mock).mockResolvedValueOnce({
        nickname: null,
        grade: null,
        targetMajor: 'Computer Science',
        testScores: [],
        activities: [],
        awards: [],
        education: [],
        essays: [],
      });
      (prisma.schoolListItem.findMany as jest.Mock).mockResolvedValueOnce([
        {
          schoolId: 'school-1',
          round: 'EA',
          school: {
            name: 'Stanford',
            nameZh: '斯坦福',
            deadlines: [],
          },
        },
      ]);

      const result = await service.getDashboardSummary(userId, 'zh');

      // Chip 1: predicts against the first school in user's list
      // Chip 2: essay brainstorm scoped to that school
      // Chip 3: reach schools for the user's targetMajor
      expect(result.quickAskSuggestions?.[0]).toMatch(/斯坦福|Stanford/);
      expect(result.quickAskSuggestions?.[1]).toMatch(/斯坦福|Stanford/);
      expect(result.quickAskSuggestions?.[2]).toContain('Computer Science');
    });
  });
});
