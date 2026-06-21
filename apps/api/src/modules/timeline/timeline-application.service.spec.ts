import { Test, TestingModule } from '@nestjs/testing';
import { TimelineApplicationService } from './timeline-application.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('TimelineApplicationService', () => {
  let service: TimelineApplicationService;
  let prisma: PrismaService;

  const mockTimeline = {
    id: 'tl-1',
    userId: 'user-1',
    schoolId: 'school-1',
    schoolName: 'MIT',
    round: 'RD',
    deadline: new Date(),
    status: 'NOT_STARTED',
    progress: 0,
    priority: 0,
    notes: null,
    createdAt: new Date(),
    tasks: [],
  };

  const mockPrisma = {
    school: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    applicationTimeline: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    applicationTask: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    globalEvent: {
      findMany: jest.fn(),
    },
    essayPrompt: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimelineApplicationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TimelineApplicationService>(
      TimelineApplicationService,
    );
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTimeline', () => {
    it('should create timeline with default tasks', async () => {
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        name: 'MIT',
        nameZh: '麻省理工',
      });
      mockPrisma.applicationTimeline.findUnique.mockResolvedValue(null);
      mockPrisma.applicationTimeline.create.mockResolvedValue(mockTimeline);

      const result = await service.createTimeline('user-1', {
        schoolId: 'school-1',
        round: 'RD',
      } as any);

      expect(result.schoolId).toBe('school-1');
      expect(mockPrisma.applicationTimeline.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when school not found', async () => {
      mockPrisma.school.findUnique.mockResolvedValue(null);

      await expect(
        service.createTimeline('user-1', {
          schoolId: 'nonexistent',
          round: 'RD',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate timeline', async () => {
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        name: 'MIT',
      });
      mockPrisma.applicationTimeline.findUnique.mockResolvedValue(mockTimeline);

      await expect(
        service.createTimeline('user-1', {
          schoolId: 'school-1',
          round: 'RD',
        } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getTimelines', () => {
    it('should return user timelines', async () => {
      mockPrisma.applicationTimeline.findMany.mockResolvedValue([mockTimeline]);

      const result = await service.getTimelines('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].schoolId).toBe('school-1');
    });
  });

  describe('generateTimelines', () => {
    it('rolls expired structured school deadlines to the next application season', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-14T12:00:00Z'));
      mockPrisma.school.findMany.mockResolvedValue([
        {
          id: 'school-1',
          name: 'Princeton University',
          nameZh: '普林斯顿大学',
          metadata: null,
          deadlines: [
            {
              id: 'dl-rd',
              round: 'RD',
              applicationDeadline: new Date('2026-01-01T00:00:00Z'),
              financialAidDeadline: null,
              essayPrompts: null,
              essayCount: null,
              interviewRequired: false,
              year: 2026,
              source: 'WEB_RESEARCH_2026-05:official',
              notes: 'source: https://admission.princeton.edu/apply',
            },
          ],
        },
      ]);
      mockPrisma.applicationTimeline.findMany.mockResolvedValue([]);
      mockPrisma.applicationTimeline.create.mockImplementation(({ data }) =>
        Promise.resolve({
          ...mockTimeline,
          id: 'tl-rolled',
          schoolId: data.schoolId,
          schoolName: data.schoolName,
          round: data.round,
          deadline: data.deadline,
          tasks: [],
        }),
      );

      const result = await service.generateTimelines('user-1', {
        schoolIds: ['school-1'],
      });

      expect(result.created).toHaveLength(1);
      expect(
        mockPrisma.applicationTimeline.create.mock.calls[0][0].data.deadline,
      ).toEqual(new Date('2027-01-01T00:00:00Z'));
      expect(result.created[0].deadline).toEqual(
        new Date('2027-01-01T00:00:00Z'),
      );
    });

    it('creates school-specific essay tasks only from source-backed verified prompts', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-14T12:00:00Z'));
      mockPrisma.school.findMany.mockResolvedValue([
        {
          id: 'school-1',
          name: 'Princeton University',
          nameZh: '普林斯顿大学',
          metadata: null,
          deadlines: [
            {
              id: 'dl-rd',
              round: 'RD',
              applicationDeadline: new Date('2026-01-01T00:00:00Z'),
              financialAidDeadline: null,
              essayPrompts: [
                { prompt: 'Unsourced deadline prompt should not be used' },
              ],
              essayCount: 2,
              interviewRequired: false,
              year: 2026,
              source: 'WEB_RESEARCH_2026-05:official',
              notes: 'source: https://admission.princeton.edu/apply',
            },
          ],
        },
      ]);
      mockPrisma.applicationTimeline.findMany.mockResolvedValue([]);
      mockPrisma.essayPrompt.findMany.mockResolvedValue([
        {
          schoolId: 'school-1',
          prompt: 'Please briefly elaborate on one activity.',
          wordLimit: 150,
        },
      ]);
      mockPrisma.applicationTimeline.create.mockImplementation(({ data }) =>
        Promise.resolve({
          ...mockTimeline,
          id: 'tl-sourced-essay',
          schoolId: data.schoolId,
          schoolName: data.schoolName,
          round: data.round,
          deadline: data.deadline,
          tasks: data.tasks.create,
        }),
      );

      await service.generateTimelines('user-1', {
        schoolIds: ['school-1'],
      });

      expect(mockPrisma.essayPrompt.findMany).toHaveBeenCalledWith({
        where: {
          schoolId: { in: ['school-1'] },
          isActive: true,
          status: 'VERIFIED',
          sources: { some: { sourceUrl: { not: null } } },
        },
        orderBy: { sortOrder: 'asc' },
        select: { schoolId: true, prompt: true, wordLimit: true },
      });
      const createdTasks =
        mockPrisma.applicationTimeline.create.mock.calls[0][0].data.tasks
          .create;
      expect(
        createdTasks.some(
          (task: { essayPrompt?: string }) =>
            task.essayPrompt === 'Please briefly elaborate on one activity.',
        ),
      ).toBe(true);
      expect(
        createdTasks.some(
          (task: { essayPrompt?: string }) =>
            task.essayPrompt === 'Unsourced deadline prompt should not be used',
        ),
      ).toBe(false);
    });

    it('does not create generic school-specific supplemental essay tasks without source-backed prompts', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-14T12:00:00Z'));
      mockPrisma.school.findMany.mockResolvedValue([
        {
          id: 'school-1',
          name: 'Princeton University',
          nameZh: '普林斯顿大学',
          metadata: null,
          deadlines: [
            {
              id: 'dl-rd',
              round: 'RD',
              applicationDeadline: new Date('2026-01-01T00:00:00Z'),
              financialAidDeadline: null,
              essayPrompts: [
                { prompt: 'Unsourced deadline prompt should not be used' },
              ],
              essayCount: 2,
              interviewRequired: false,
              year: 2026,
              source: 'WEB_RESEARCH_2026-05:official',
              notes: 'source: https://admission.princeton.edu/apply',
            },
          ],
        },
      ]);
      mockPrisma.applicationTimeline.findMany.mockResolvedValue([]);
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);
      mockPrisma.applicationTimeline.create.mockImplementation(({ data }) =>
        Promise.resolve({
          ...mockTimeline,
          id: 'tl-no-school-essay',
          schoolId: data.schoolId,
          schoolName: data.schoolName,
          round: data.round,
          deadline: data.deadline,
          tasks: data.tasks.create,
        }),
      );

      await service.generateTimelines('user-1', {
        schoolIds: ['school-1'],
      });

      const createdTasks =
        mockPrisma.applicationTimeline.create.mock.calls[0][0].data.tasks
          .create;
      expect(
        createdTasks.some((task: { title: string; essayPrompt?: string }) =>
          task.title.startsWith('补充文书:'),
        ),
      ).toBe(false);
      expect(
        createdTasks.some((task: { title: string }) =>
          task.title.startsWith('完成学校补充文书'),
        ),
      ).toBe(false);
      expect(
        createdTasks.some(
          (task: { essayPrompt?: string }) =>
            task.essayPrompt === 'Common App Personal Statement',
        ),
      ).toBe(true);
    });

    it('skips metadata and default deadline fallbacks when source-backed school deadlines are unavailable', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-14T12:00:00Z'));
      mockPrisma.school.findMany.mockResolvedValue([
        {
          id: 'school-1',
          name: 'Princeton University',
          nameZh: '普林斯顿大学',
          metadata: { deadlines: { rd: 'January 1' } },
          deadlines: [
            {
              id: 'dl-manual',
              round: 'RD',
              applicationDeadline: new Date('2026-01-01T00:00:00Z'),
              financialAidDeadline: null,
              essayPrompts: null,
              essayCount: null,
              interviewRequired: false,
              year: 2026,
              source: 'MANUAL',
              notes: 'source: https://admission.princeton.edu/apply',
            },
            {
              id: 'dl-no-source-url',
              round: 'EA',
              applicationDeadline: new Date('2025-11-01T00:00:00Z'),
              financialAidDeadline: null,
              essayPrompts: null,
              essayCount: null,
              interviewRequired: false,
              year: 2026,
              source: 'WEB_RESEARCH_2026-05:official',
              notes: 'reviewed locally',
            },
          ],
        },
      ]);
      mockPrisma.applicationTimeline.findMany.mockResolvedValue([]);

      const result = await service.generateTimelines('user-1', {
        schoolIds: ['school-1'],
      });

      expect(mockPrisma.school.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['school-1'] } },
          include: expect.objectContaining({
            deadlines: expect.objectContaining({
              where: {
                year: { in: [2026, 2027] },
                source: { not: 'MANUAL' },
                notes: { not: null },
              },
            }),
          }),
        }),
      );
      expect(mockPrisma.applicationTimeline.create).not.toHaveBeenCalled();
      expect(mockPrisma.essayPrompt.findMany).not.toHaveBeenCalled();
      expect(result.created).toEqual([]);
      expect(result.failed).toEqual([
        { schoolId: 'school-1', reason: 'DEADLINE_SOURCE_REQUIRED' },
      ]);
    });

    it('uses next-cycle (applicationYear+1) source-backed deadlines in the off-season', async () => {
      // May 2026 -> applicationYear 2026, but the active cycle's deadlines are
      // stored under fall-entry year 2027 (future). Generation must still find
      // them rather than returning an empty/undated result.
      jest.useFakeTimers().setSystemTime(new Date('2026-05-14T12:00:00Z'));
      mockPrisma.school.findMany.mockResolvedValue([
        {
          id: 'school-1',
          name: 'Princeton University',
          nameZh: '普林斯顿大学',
          metadata: null,
          deadlines: [
            {
              id: 'dl-next-cycle',
              round: 'ED',
              applicationDeadline: new Date('2026-11-01T00:00:00Z'),
              financialAidDeadline: null,
              essayPrompts: null,
              essayCount: null,
              interviewRequired: false,
              year: 2027,
              source: 'WEB_RESEARCH_2026-05:official',
              notes: 'source: https://admission.princeton.edu/apply',
            },
          ],
        },
      ]);
      mockPrisma.applicationTimeline.findMany.mockResolvedValue([]);
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);
      mockPrisma.applicationTimeline.create.mockImplementation(({ data }) =>
        Promise.resolve({
          ...mockTimeline,
          id: 'tl-next-cycle',
          schoolId: data.schoolId,
          schoolName: data.schoolName,
          round: data.round,
          deadline: data.deadline,
          tasks: [],
        }),
      );

      const result = await service.generateTimelines('user-1', {
        schoolIds: ['school-1'],
      });

      expect(result.created).toHaveLength(1);
      expect(result.created[0].deadline).toEqual(
        new Date('2026-11-01T00:00:00Z'),
      );
    });
  });

  describe('getGlobalEvents', () => {
    it('returns future events and rolls recurring events without an explicit year', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-14T12:00:00Z'));
      mockPrisma.globalEvent.findMany.mockResolvedValue([
        {
          id: 'old-non-recurring',
          title: 'Old One-Off',
          category: 'OTHER',
          eventDate: new Date('2026-03-01T00:00:00Z'),
          registrationDeadline: null,
          lateDeadline: null,
          resultDate: null,
          year: 2026,
          isRecurring: false,
          isActive: true,
        },
        {
          id: 'old-recurring',
          title: 'Recurring Competition',
          category: 'COMPETITION',
          eventDate: new Date('2026-04-01T00:00:00Z'),
          registrationDeadline: new Date('2026-03-01T00:00:00Z'),
          lateDeadline: null,
          resultDate: null,
          year: 2026,
          isRecurring: true,
          isActive: true,
        },
        {
          id: 'future',
          title: 'Future Test',
          category: 'TEST',
          eventDate: new Date('2026-06-01T00:00:00Z'),
          registrationDeadline: null,
          lateDeadline: null,
          resultDate: null,
          year: 2026,
          isRecurring: false,
          isActive: true,
        },
      ]);

      const result = await service.getGlobalEvents();

      expect(mockPrisma.globalEvent.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { eventDate: 'asc' },
      });
      expect(result.map((event) => event.id)).toEqual([
        'future',
        'old-recurring',
      ]);
      expect(result[1].eventDate).toEqual(new Date('2027-04-01T00:00:00Z'));
      expect(result[1].registrationDeadline).toEqual(
        new Date('2027-03-01T00:00:00Z'),
      );
    });

    it('preserves explicit year filtering', async () => {
      mockPrisma.globalEvent.findMany.mockResolvedValue([]);

      await service.getGlobalEvents(2026);

      expect(mockPrisma.globalEvent.findMany).toHaveBeenCalledWith({
        where: { isActive: true, year: 2026 },
        orderBy: { eventDate: 'asc' },
      });
    });
  });

  describe('deleteTimeline', () => {
    it('should delete owned timeline', async () => {
      mockPrisma.applicationTimeline.findFirst.mockResolvedValue(mockTimeline);

      await service.deleteTimeline('user-1', 'tl-1');

      expect(mockPrisma.applicationTimeline.delete).toHaveBeenCalledWith({
        where: { id: 'tl-1' },
      });
    });

    it('should throw NotFoundException for non-owned timeline', async () => {
      mockPrisma.applicationTimeline.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteTimeline('user-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('mapTaskToResponse source state', () => {
    it('labels generic Common App essay tasks without treating them as school-specific source facts', () => {
      const result = service.mapTaskToResponse({
        id: 'task-common-app',
        timelineId: 'tl-1',
        title: '完成 Common App 主文书',
        type: 'ESSAY',
        completed: false,
        sortOrder: 0,
        essayPrompt: 'Common App Personal Statement',
      });

      expect(result.sourceStatus).toBe('generic');
      expect(result.sourcePolicy).toContain('Generic Common App');
    });

    it('labels school-specific essay tasks as source-review required unless linked to source evidence', () => {
      const result = service.mapTaskToResponse({
        id: 'task-school-essay',
        timelineId: 'tl-1',
        title: '完成 Why Duke 文书',
        type: 'ESSAY',
        completed: false,
        sortOrder: 1,
        essayPrompt: null,
      });

      expect(result.sourceStatus).toBe('source_review_required');
      expect(result.sourcePolicy).toContain('source-backed verified');
    });
  });

  describe('parseMetadataDate', () => {
    it('should parse ISO date', () => {
      const result = service.parseMetadataDate('2026-01-15', 2026);

      expect(result).not.toBeNull();
      expect(result!.getMonth()).toBe(0); // January
      expect(result!.getDate()).toBe(15);
    });

    it('should parse "Month Day" format', () => {
      const result = service.parseMetadataDate('January 15', 2026);

      expect(result).not.toBeNull();
      expect(result!.getMonth()).toBe(0);
    });

    it('should return null for unparseable date', () => {
      const result = service.parseMetadataDate('invalid', 2026);

      expect(result).toBeNull();
    });
  });

  describe('effectiveDeadline (read-time roll-forward)', () => {
    afterEach(() => jest.useRealTimers());

    const baseTimeline = (status: string, deadline: Date) => ({
      id: 't1',
      schoolId: 's1',
      schoolName: 'MIT',
      round: 'RD',
      deadline,
      status,
      progress: 0,
      priority: 0,
      notes: null,
      tasks: [],
      createdAt: new Date('2025-09-01T00:00:00Z'),
    });

    it('rolls a past deadline to its next annual occurrence for active timelines', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-20T12:00:00Z'));
      const res = service.mapTimelineToResponse(
        baseTimeline('IN_PROGRESS', new Date('2026-01-01T00:00:00Z')),
      );
      expect(res.deadline).toEqual(new Date('2027-01-01T00:00:00Z'));
    });

    it('leaves a future deadline untouched', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-20T12:00:00Z'));
      const res = service.mapTimelineToResponse(
        baseTimeline('NOT_STARTED', new Date('2026-11-01T00:00:00Z')),
      );
      expect(res.deadline).toEqual(new Date('2026-11-01T00:00:00Z'));
    });

    it('rolls a past deadline for NOT_STARTED timelines too', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-20T12:00:00Z'));
      const res = service.mapTimelineToResponse(
        baseTimeline('NOT_STARTED', new Date('2026-01-01T00:00:00Z')),
      );
      expect(res.deadline).toEqual(new Date('2027-01-01T00:00:00Z'));
    });

    it('returns undefined when the timeline has no deadline', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-20T12:00:00Z'));
      const res = service.mapTimelineToResponse({
        ...baseTimeline('IN_PROGRESS', new Date('2026-01-01T00:00:00Z')),
        deadline: null,
      });
      expect(res.deadline).toBeUndefined();
    });

    it.each(['SUBMITTED', 'ACCEPTED', 'REJECTED', 'WAITLISTED', 'WITHDRAWN'])(
      'keeps the real past deadline for terminal status %s',
      (status) => {
        jest.useFakeTimers().setSystemTime(new Date('2026-06-20T12:00:00Z'));
        const res = service.mapTimelineToResponse(
          baseTimeline(status, new Date('2026-01-01T00:00:00Z')),
        );
        expect(res.deadline).toEqual(new Date('2026-01-01T00:00:00Z'));
      },
    );
  });

  describe('getOverview effective-deadline filter', () => {
    afterEach(() => jest.useRealTimers());

    const row = (
      id: string,
      schoolName: string,
      status: string,
      deadline: Date,
    ) => ({
      id,
      schoolId: id,
      schoolName,
      round: 'RD',
      deadline,
      status,
      progress: 0,
      priority: 0,
      notes: null,
      tasks: [],
      createdAt: new Date('2025-09-01T00:00:00Z'),
    });

    it('surfaces a drifted active timeline (rolled) as upcoming and excludes submitted', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-20T12:00:00Z'));
      mockPrisma.applicationTimeline.findMany.mockResolvedValue([
        row(
          'past-active',
          'MIT',
          'IN_PROGRESS',
          new Date('2026-01-01T00:00:00Z'),
        ),
        row(
          'future-active',
          'Yale',
          'NOT_STARTED',
          new Date('2026-11-15T00:00:00Z'),
        ),
        row(
          'past-submitted',
          'Columbia',
          'SUBMITTED',
          new Date('2026-01-02T00:00:00Z'),
        ),
      ]);
      mockPrisma.applicationTask.findMany.mockResolvedValue([]);

      const overview = await service.getOverview('u1');
      const ids = overview.upcomingDeadlines.map((t) => t.id);

      // Stored deadline drifted into the past but rolls to its next occurrence →
      // still upcoming. Submitted (terminal) is excluded.
      expect(ids).toContain('past-active');
      expect(ids).toContain('future-active');
      expect(ids).not.toContain('past-submitted');
      const mit = overview.upcomingDeadlines.find(
        (t) => t.id === 'past-active',
      );
      expect(mit?.deadline).toEqual(new Date('2027-01-01T00:00:00Z'));
    });
  });

  // The application-task mutations load the task by id ALONE
  // (findFirst({ where: { id } })) and enforce ownership in code via
  // `task.timeline.userId !== userId` — NOT via a DB-level userId filter. These
  // guardrail tests lock that in: a task on a different user's timeline must be
  // rejected with NotFoundException and trigger no write, so a future "simplify
  // to a bare findUnique" can't silently reintroduce a cross-user IDOR with the
  // suite still green.
  describe('application-task mutation ownership (IDOR guardrail)', () => {
    const foreignTask = {
      id: 'task-x',
      timelineId: 'tl-foreign',
      completed: false,
      timeline: { id: 'tl-foreign', userId: 'other-user' },
    };

    it('updateTask rejects a foreign-user task and writes nothing', async () => {
      mockPrisma.applicationTask.findFirst.mockResolvedValue(foreignTask);

      await expect(
        service.updateTask('user-1', 'task-x', { title: 'hijack' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.applicationTask.update).not.toHaveBeenCalled();
    });

    it('deleteTask rejects a foreign-user task and deletes nothing', async () => {
      mockPrisma.applicationTask.findFirst.mockResolvedValue(foreignTask);

      await expect(service.deleteTask('user-1', 'task-x')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.applicationTask.delete).not.toHaveBeenCalled();
    });

    it('toggleTaskComplete rejects a foreign-user task and never opens a transaction', async () => {
      mockPrisma.applicationTask.findFirst.mockResolvedValue(foreignTask);

      await expect(
        service.toggleTaskComplete('user-1', 'task-x'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
