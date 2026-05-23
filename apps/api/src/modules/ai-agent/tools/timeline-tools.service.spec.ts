import { Test, TestingModule } from '@nestjs/testing';
import { TimelineToolsService } from './timeline-tools.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LLMService } from '../core/llm.service';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';

describe('TimelineToolsService', () => {
  let service: TimelineToolsService;
  let prisma: {
    deadline: { findMany: jest.Mock };
    schoolDeadline: { findMany: jest.Mock };
    personalEvent: { findMany: jest.Mock; create: jest.Mock };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimelineToolsService,
        {
          provide: PrismaService,
          useValue: {
            deadline: { findMany: jest.fn().mockResolvedValue([]) },
            schoolDeadline: { findMany: jest.fn().mockResolvedValue([]) },
            personalEvent: {
              findMany: jest.fn().mockResolvedValue([]),
              create: jest.fn(),
            },
          },
        },
        {
          provide: LLMService,
          useValue: {
            chatSimple: jest.fn().mockResolvedValue('{"timeline":[]}'),
            chatSimpleGuarded: jest.fn().mockResolvedValue('{"timeline":[]}'),
            call: jest.fn(),
          },
        },
        {
          provide: SchoolLookupHelper,
          useValue: {
            findSchool: jest.fn(),
            displayName: jest.fn((school, locale) =>
              locale === 'zh' ? school.nameZh || school.name : school.name,
            ),
          },
        },
      ],
    }).compile();

    service = module.get(TimelineToolsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register tool handlers', () => {
    const handlers = service.getHandlers();
    expect(handlers.has('get_deadlines')).toBe(true);
    expect(handlers.has('create_timeline')).toBe(true);
    expect(handlers.has('get_personal_events')).toBe(true);
    expect(handlers.has('create_personal_event')).toBe(true);
  });

  it('should return error when no schoolIds provided for getDeadlines', async () => {
    const result = await service.getDeadlines([], undefined, 'en');
    expect(result).toHaveProperty('error');
  });

  it('should query sourced current-year school deadlines instead of metadata deadlines', async () => {
    prisma.schoolDeadline.findMany.mockResolvedValue([]);

    const result = await service.getDeadlines(['school-1'], 'rd', 'en');

    expect(prisma.schoolDeadline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: { in: ['school-1'] },
          year:
            new Date().getMonth() >= 7
              ? new Date().getFullYear() + 1
              : new Date().getFullYear(),
          round: 'RD',
          source: { not: 'MANUAL' },
          notes: { contains: 'source:' },
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        sourcePolicy: 'no_source_backed_current_year_deadlines',
        deadlines: [],
      }),
    );
  });

  it('should return source-backed deadline rows with source URLs', async () => {
    prisma.schoolDeadline.findMany.mockResolvedValue([
      {
        round: 'RD',
        year:
          new Date().getMonth() >= 7
            ? new Date().getFullYear() + 1
            : new Date().getFullYear(),
        applicationDeadline: new Date('2099-01-01T00:00:00.000Z'),
        financialAidDeadline: null,
        decisionDate: new Date('2099-03-31T00:00:00.000Z'),
        source: 'SCRAPED',
        notes: 'source: https://example.edu/apply/deadlines',
        school: { name: 'Example University', nameZh: '示例大学' },
      },
    ]);

    const result = await service.getDeadlines(['school-1'], undefined, 'en');

    expect(result.sourcePolicy).toBe('source_backed_current_year_deadlines');
    expect(result.deadlines).toEqual([
      expect.objectContaining({
        school: 'Example University',
        sourcePolicy: 'source_backed_current_year_deadlines',
        deadlines: {
          RD: expect.objectContaining({
            date: '2099-01-01T00:00:00.000Z',
            source: 'SCRAPED',
            sourceUrl: 'https://example.edu/apply/deadlines',
            decisionDate: '2099-03-31T00:00:00.000Z',
          }),
        },
      }),
    ]);
  });

  it('should return personal events for user', async () => {
    prisma.personalEvent.findMany.mockResolvedValue([
      {
        id: 'e1',
        title: 'Test',
        category: 'ACADEMIC',
        status: 'IN_PROGRESS',
        progress: 50,
        deadline: new Date(),
        eventDate: new Date(),
        tasks: [{ title: 'Task 1', completed: false, dueDate: new Date() }],
      },
    ]);
    const result = await service.getPersonalEvents('user-1', undefined, 'en');
    expect(prisma.personalEvent.findMany).toHaveBeenCalled();
    expect(Array.isArray(result)).toBe(true);
  });
});
