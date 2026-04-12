import { Test, TestingModule } from '@nestjs/testing';
import { TimelinePersonalEventService } from './timeline-personal-event.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('TimelinePersonalEventService', () => {
  let service: TimelinePersonalEventService;
  let prisma: PrismaService;

  const mockEvent = {
    id: 'evt-1',
    userId: 'user-1',
    title: 'SAT Exam',
    category: 'TEST',
    deadline: new Date(),
    eventDate: new Date(),
    status: 'NOT_STARTED',
    progress: 0,
    priority: 0,
    description: null,
    url: null,
    notes: null,
    globalEventId: null,
    createdAt: new Date(),
    tasks: [],
  };

  const mockPrisma = {
    personalEvent: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    personalTask: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    globalEvent: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimelinePersonalEventService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TimelinePersonalEventService>(
      TimelinePersonalEventService,
    );
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPersonalEvent', () => {
    it('should create event with template tasks', async () => {
      mockPrisma.personalEvent.create.mockResolvedValue(mockEvent);

      const result = await service.createPersonalEvent('user-1', {
        title: 'SAT Exam',
        category: 'TEST',
      } as any);

      expect(result.title).toBe('SAT Exam');
      expect(mockPrisma.personalEvent.create).toHaveBeenCalled();
    });
  });

  describe('subscribeGlobalEvent', () => {
    it('should create personal event from global event', async () => {
      mockPrisma.globalEvent.findUnique.mockResolvedValue({
        id: 'ge-1',
        title: 'SAT Test',
        titleZh: 'SAT考试',
        category: 'TEST',
        eventDate: new Date(),
      });
      mockPrisma.personalEvent.findUnique.mockResolvedValue(null);
      mockPrisma.personalEvent.create.mockResolvedValue(mockEvent);

      const result = await service.subscribeGlobalEvent('user-1', {
        globalEventId: 'ge-1',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.personalEvent.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException for missing global event', async () => {
      mockPrisma.globalEvent.findUnique.mockResolvedValue(null);

      await expect(
        service.subscribeGlobalEvent('user-1', {
          globalEventId: 'nonexistent',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate subscription', async () => {
      mockPrisma.globalEvent.findUnique.mockResolvedValue({
        id: 'ge-1',
        category: 'TEST',
      });
      mockPrisma.personalEvent.findUnique.mockResolvedValue(mockEvent);

      await expect(
        service.subscribeGlobalEvent('user-1', { globalEventId: 'ge-1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getPersonalEvents', () => {
    it('should return user events', async () => {
      mockPrisma.personalEvent.findMany.mockResolvedValue([mockEvent]);

      const result = await service.getPersonalEvents('user-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('deletePersonalEvent', () => {
    it('should delete owned event', async () => {
      mockPrisma.personalEvent.findFirst.mockResolvedValue(mockEvent);

      await service.deletePersonalEvent('user-1', 'evt-1');

      expect(mockPrisma.personalEvent.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-owned event', async () => {
      mockPrisma.personalEvent.findFirst.mockResolvedValue(null);

      await expect(
        service.deletePersonalEvent('user-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('togglePersonalTaskComplete', () => {
    it('should toggle task completion', async () => {
      mockPrisma.personalTask.findFirst.mockResolvedValue({
        id: 'task-1',
        eventId: 'evt-1',
        completed: false,
        event: { userId: 'user-1' },
      });
      mockPrisma.personalTask.update.mockResolvedValue({
        id: 'task-1',
        eventId: 'evt-1',
        completed: true,
        completedAt: new Date(),
      });
      mockPrisma.personalTask.findMany.mockResolvedValue([{ completed: true }]);
      mockPrisma.personalEvent.findUnique.mockResolvedValue({
        status: 'IN_PROGRESS',
      });
      mockPrisma.personalEvent.update.mockResolvedValue({});

      const result = await service.togglePersonalTaskComplete(
        'user-1',
        'task-1',
      );

      expect(result.completed).toBe(true);
    });

    it('should throw NotFoundException for non-owned task', async () => {
      mockPrisma.personalTask.findFirst.mockResolvedValue(null);

      await expect(
        service.togglePersonalTaskComplete('user-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
