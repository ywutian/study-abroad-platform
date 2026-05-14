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
      mockPrisma.school.findUnique.mockResolvedValue({
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
          },
        ],
      });
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
});
