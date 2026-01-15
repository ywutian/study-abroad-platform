import { Test, TestingModule } from '@nestjs/testing';
import { TimelineService } from './timeline.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ApplicationStatus, TaskType } from '@prisma/client';
import {
  ApplicationRound,
  TimelineStatus,
  TaskType as DtoTaskType,
} from './dto/timeline.dto';

describe('TimelineService', () => {
  let service: TimelineService;
  let prismaService: PrismaService;

  const mockUserId = 'user-123';
  const mockTimelineId = 'timeline-123';
  const mockTaskId = 'task-123';
  const mockSchoolId = 'school-123';

  const mockSchool = {
    id: mockSchoolId,
    name: 'Harvard University',
    nameZh: '哈佛大学',
  };

  const mockTimeline = {
    id: mockTimelineId,
    userId: mockUserId,
    schoolId: mockSchoolId,
    schoolName: '哈佛大学',
    round: 'ED',
    deadline: new Date('2026-11-01'),
    status: ApplicationStatus.NOT_STARTED,
    progress: 0,
    priority: 1,
    notes: 'Dream school',
    createdAt: new Date(),
    updatedAt: new Date(),
    tasks: [],
  };

  const mockTask = {
    id: mockTaskId,
    timelineId: mockTimelineId,
    title: 'Complete Essay',
    type: TaskType.ESSAY,
    description: 'Write personal statement',
    dueDate: new Date('2026-10-15'),
    completed: false,
    completedAt: null,
    essayPrompt: 'Common App',
    wordLimit: 650,
    sortOrder: 0,
    timeline: { userId: mockUserId },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimelineService,
        {
          provide: PrismaService,
          useValue: {
            school: {
              findUnique: jest.fn(),
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
            personalEvent: {
              findMany: jest.fn().mockResolvedValue([]),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<TimelineService>(TimelineService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Timeline CRUD Tests
  // ============================================

  describe('createTimeline', () => {
    it('should create timeline with default tasks', async () => {
      (prismaService.school.findUnique as jest.Mock).mockResolvedValue(
        mockSchool,
      );
      (
        prismaService.applicationTimeline.findUnique as jest.Mock
      ).mockResolvedValue(null);
      (prismaService.applicationTimeline.create as jest.Mock).mockResolvedValue(
        {
          ...mockTimeline,
          tasks: [mockTask],
        },
      );

      const result = await service.createTimeline(mockUserId, {
        schoolId: mockSchoolId,
        round: ApplicationRound.ED,
        deadline: '2026-11-01',
      });

      expect(result.schoolId).toBe(mockSchoolId);
      expect(result.round).toBe('ED');
      expect(prismaService.applicationTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUserId,
            schoolId: mockSchoolId,
            tasks: expect.any(Object),
          }),
        }),
      );
    });

    it('should throw NotFoundException if school not found', async () => {
      (prismaService.school.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createTimeline(mockUserId, {
          schoolId: 'invalid',
          round: ApplicationRound.ED,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if timeline already exists', async () => {
      (prismaService.school.findUnique as jest.Mock).mockResolvedValue(
        mockSchool,
      );
      (
        prismaService.applicationTimeline.findUnique as jest.Mock
      ).mockResolvedValue(mockTimeline);

      await expect(
        service.createTimeline(mockUserId, {
          schoolId: mockSchoolId,
          round: ApplicationRound.ED,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('generateTimelines', () => {
    it('should generate timelines for multiple schools', async () => {
      const mockSchoolWithDeadlines = {
        ...mockSchool,
        deadlines: [
          {
            id: 'dl-1',
            schoolId: mockSchoolId,
            round: 'RD',
            applicationDeadline: new Date('2027-01-01'),
            financialAidDeadline: null,
            year:
              new Date().getMonth() + 1 >= 8
                ? new Date().getFullYear() + 1
                : new Date().getFullYear(),
            essayPrompts: null,
            essayCount: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };
      (prismaService.school.findUnique as jest.Mock).mockResolvedValue(
        mockSchoolWithDeadlines,
      );
      (
        prismaService.applicationTimeline.findMany as jest.Mock
      ).mockResolvedValue([]);
      (prismaService.applicationTimeline.create as jest.Mock).mockResolvedValue(
        mockTimeline,
      );

      const result = await service.generateTimelines(mockUserId, {
        schoolIds: ['school-1', 'school-2'],
      });

      expect(result.length).toBeGreaterThan(0);
    });

    it('should skip existing timelines', async () => {
      (prismaService.school.findUnique as jest.Mock).mockResolvedValue(
        mockSchool,
      );
      (
        prismaService.applicationTimeline.findFirst as jest.Mock
      ).mockResolvedValue(mockTimeline);

      const result = await service.generateTimelines(mockUserId, {
        schoolIds: [mockSchoolId],
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('getTimelines', () => {
    it('should return all timelines for user', async () => {
      (
        prismaService.applicationTimeline.findMany as jest.Mock
      ).mockResolvedValue([mockTimeline]);

      const result = await service.getTimelines(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].schoolId).toBe(mockSchoolId);
    });
  });

  describe('getTimelineById', () => {
    it('should return timeline with tasks', async () => {
      (
        prismaService.applicationTimeline.findFirst as jest.Mock
      ).mockResolvedValue({
        ...mockTimeline,
        tasks: [mockTask],
      });

      const result = await service.getTimelineById(mockUserId, mockTimelineId);

      expect(result.id).toBe(mockTimelineId);
      expect(result.tasksTotal).toBe(1);
    });

    it('should throw NotFoundException if timeline not found', async () => {
      (
        prismaService.applicationTimeline.findFirst as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        service.getTimelineById(mockUserId, 'invalid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTimeline', () => {
    it('should update timeline status and progress', async () => {
      (
        prismaService.applicationTimeline.findFirst as jest.Mock
      ).mockResolvedValue(mockTimeline);
      (prismaService.applicationTimeline.update as jest.Mock).mockResolvedValue(
        {
          ...mockTimeline,
          status: ApplicationStatus.IN_PROGRESS,
          progress: 50,
          tasks: [],
        },
      );

      const result = await service.updateTimeline(mockUserId, mockTimelineId, {
        status: TimelineStatus.IN_PROGRESS,
        progress: 50,
      });

      expect(result.status).toBe(ApplicationStatus.IN_PROGRESS);
    });

    it('should throw NotFoundException if timeline not found', async () => {
      (
        prismaService.applicationTimeline.findFirst as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        service.updateTimeline(mockUserId, 'invalid', { progress: 50 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteTimeline', () => {
    it('should delete timeline', async () => {
      (
        prismaService.applicationTimeline.findFirst as jest.Mock
      ).mockResolvedValue(mockTimeline);
      (prismaService.applicationTimeline.delete as jest.Mock).mockResolvedValue(
        mockTimeline,
      );

      await service.deleteTimeline(mockUserId, mockTimelineId);

      expect(prismaService.applicationTimeline.delete).toHaveBeenCalledWith({
        where: { id: mockTimelineId },
      });
    });

    it('should throw NotFoundException if timeline not found', async () => {
      (
        prismaService.applicationTimeline.findFirst as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        service.deleteTimeline(mockUserId, 'invalid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================
  // Overview Tests
  // ============================================

  describe('getOverview', () => {
    it('should return timeline statistics', async () => {
      const timelines = [
        { ...mockTimeline, status: ApplicationStatus.SUBMITTED, tasks: [] },
        {
          ...mockTimeline,
          id: 'tl-2',
          status: ApplicationStatus.IN_PROGRESS,
          tasks: [],
        },
        {
          ...mockTimeline,
          id: 'tl-3',
          status: ApplicationStatus.NOT_STARTED,
          tasks: [],
        },
      ];
      (
        prismaService.applicationTimeline.findMany as jest.Mock
      ).mockResolvedValue(timelines);
      (prismaService.applicationTask.findMany as jest.Mock).mockResolvedValue(
        [],
      );

      const result = await service.getOverview(mockUserId);

      expect(result.totalSchools).toBe(3);
      expect(result.submitted).toBe(1);
      expect(result.inProgress).toBe(1);
      expect(result.notStarted).toBe(1);
    });
  });

  // ============================================
  // Task CRUD Tests
  // ============================================

  describe('createTask', () => {
    it('should create task and update timeline progress', async () => {
      (
        prismaService.applicationTimeline.findFirst as jest.Mock
      ).mockResolvedValue(mockTimeline);
      (prismaService.applicationTask.findFirst as jest.Mock).mockResolvedValue({
        sortOrder: 5,
      });
      (prismaService.applicationTask.create as jest.Mock).mockResolvedValue(
        mockTask,
      );
      (prismaService.applicationTask.findMany as jest.Mock).mockResolvedValue([
        mockTask,
      ]);
      (prismaService.applicationTimeline.update as jest.Mock).mockResolvedValue(
        mockTimeline,
      );

      const result = await service.createTask(mockUserId, {
        timelineId: mockTimelineId,
        title: 'Complete Essay',
        type: DtoTaskType.ESSAY,
      });

      expect(result.title).toBe('Complete Essay');
    });

    it('should throw NotFoundException if timeline not found', async () => {
      (
        prismaService.applicationTimeline.findFirst as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        service.createTask(mockUserId, {
          timelineId: 'invalid',
          title: 'Task',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTask', () => {
    it('should update task', async () => {
      (prismaService.applicationTask.findFirst as jest.Mock).mockResolvedValue(
        mockTask,
      );
      (prismaService.applicationTask.update as jest.Mock).mockResolvedValue({
        ...mockTask,
        title: 'Updated Task',
      });
      (prismaService.applicationTask.findMany as jest.Mock).mockResolvedValue([
        mockTask,
      ]);
      (prismaService.applicationTimeline.update as jest.Mock).mockResolvedValue(
        mockTimeline,
      );

      const result = await service.updateTask(mockUserId, mockTaskId, {
        title: 'Updated Task',
      });

      expect(result.title).toBe('Updated Task');
    });

    it('should throw NotFoundException if task not found', async () => {
      (prismaService.applicationTask.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.updateTask(mockUserId, 'invalid', { title: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if task belongs to another user', async () => {
      (prismaService.applicationTask.findFirst as jest.Mock).mockResolvedValue({
        ...mockTask,
        timeline: { userId: 'other-user' },
      });

      await expect(
        service.updateTask(mockUserId, mockTaskId, { title: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteTask', () => {
    it('should delete task and update timeline progress', async () => {
      (prismaService.applicationTask.findFirst as jest.Mock).mockResolvedValue(
        mockTask,
      );
      (prismaService.applicationTask.delete as jest.Mock).mockResolvedValue(
        mockTask,
      );
      (prismaService.applicationTask.findMany as jest.Mock).mockResolvedValue(
        [],
      );
      (prismaService.applicationTimeline.update as jest.Mock).mockResolvedValue(
        mockTimeline,
      );

      await service.deleteTask(mockUserId, mockTaskId);

      expect(prismaService.applicationTask.delete).toHaveBeenCalledWith({
        where: { id: mockTaskId },
      });
    });
  });

  describe('toggleTaskComplete', () => {
    it('should toggle task from incomplete to complete', async () => {
      (prismaService.applicationTask.findFirst as jest.Mock).mockResolvedValue(
        mockTask,
      );
      (prismaService.applicationTask.update as jest.Mock).mockResolvedValue({
        ...mockTask,
        completed: true,
        completedAt: new Date(),
      });
      (prismaService.applicationTask.findMany as jest.Mock).mockResolvedValue([
        { ...mockTask, completed: true },
      ]);
      (prismaService.applicationTimeline.update as jest.Mock).mockResolvedValue(
        mockTimeline,
      );

      const result = await service.toggleTaskComplete(mockUserId, mockTaskId);

      expect(result.completed).toBe(true);
      expect(result.completedAt).toBeDefined();
    });

    it('should toggle task from complete to incomplete', async () => {
      (prismaService.applicationTask.findFirst as jest.Mock).mockResolvedValue({
        ...mockTask,
        completed: true,
        completedAt: new Date(),
      });
      (prismaService.applicationTask.update as jest.Mock).mockResolvedValue({
        ...mockTask,
        completed: false,
        completedAt: null,
      });
      (prismaService.applicationTask.findMany as jest.Mock).mockResolvedValue([
        mockTask,
      ]);
      (prismaService.applicationTimeline.update as jest.Mock).mockResolvedValue(
        mockTimeline,
      );

      const result = await service.toggleTaskComplete(mockUserId, mockTaskId);

      expect(result.completed).toBe(false);
      expect(result.completedAt).toBeNull();
    });
  });
});
