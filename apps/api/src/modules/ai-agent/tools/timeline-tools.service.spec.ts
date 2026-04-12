import { Test, TestingModule } from '@nestjs/testing';
import { TimelineToolsService } from './timeline-tools.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LLMService } from '../core/llm.service';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';

describe('TimelineToolsService', () => {
  let service: TimelineToolsService;
  let prisma: {
    deadline: { findMany: jest.Mock };
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
            call: jest.fn(),
          },
        },
        {
          provide: SchoolLookupHelper,
          useValue: { findSchool: jest.fn() },
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
