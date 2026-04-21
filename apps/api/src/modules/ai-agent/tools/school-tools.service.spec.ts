import { Test, TestingModule } from '@nestjs/testing';
import { SchoolToolsService } from './school-tools.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';

describe('SchoolToolsService', () => {
  let service: SchoolToolsService;
  let schoolLookup: jest.Mocked<SchoolLookupHelper>;
  let prisma: {
    school: { findUnique: jest.Mock; findMany: jest.Mock };
    essayPrompt: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      school: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      essayPrompt: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolToolsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: SchoolLookupHelper,
          useValue: {
            findSchool: jest.fn(),
            searchSchools: jest.fn().mockResolvedValue([]),
            sortByRelevance: jest.fn().mockReturnValue([]),
          },
        },
      ],
    }).compile();

    service = module.get(SchoolToolsService);
    schoolLookup = module.get(SchoolLookupHelper);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register tool handlers', () => {
    const handlers = service.getHandlers();
    expect(handlers.has('search_schools')).toBe(true);
    expect(handlers.has('get_school_details')).toBe(true);
    expect(handlers.has('compare_schools')).toBe(true);
  });

  it('should search schools via lookup helper', async () => {
    schoolLookup.searchSchools.mockResolvedValue([
      { id: 's1', name: 'MIT', usNewsRank: 2 } as any,
    ]);
    schoolLookup.sortByRelevance.mockReturnValue([
      { id: 's1', name: 'MIT', usNewsRank: 2 } as any,
    ]);

    const result = await service.searchSchools({ query: 'MIT' });
    expect(schoolLookup.searchSchools).toHaveBeenCalledWith({ query: 'MIT' });
    expect(result).toBeDefined();
  });

  it('returns testingPolicy for school details and preserves legacy compatibility flag', async () => {
    schoolLookup.findSchool.mockResolvedValue({
      id: 'ucb',
      name: 'University of California, Berkeley',
    } as any);
    prisma.school.findUnique.mockResolvedValue({
      id: 'ucb',
      name: 'University of California, Berkeley',
      nameZh: '加州大学伯克利分校',
      state: 'CA',
      usNewsRank: 1,
      acceptanceRate: 11.0,
      tuition: 50000,
      avgSalary: 95000,
      metadata: {},
      testingPolicy: 'BLIND',
      testOptional: false,
    } as any);

    const result = await service.getSchoolDetails('ucb');

    expect(result.testingPolicy).toBe('BLIND');
    expect(result.testOptional).toBe(false);
  });

  it('returns testingPolicy in school comparisons', async () => {
    prisma.school.findMany.mockResolvedValue([
      {
        id: 'ucb',
        name: 'University of California, Berkeley',
        usNewsRank: 1,
        acceptanceRate: 11.0,
        tuition: 50000,
        avgSalary: 95000,
        state: 'CA',
        testingPolicy: 'BLIND',
        testOptional: false,
      },
      {
        id: 'mit',
        name: 'MIT',
        usNewsRank: 2,
        acceptanceRate: 4.0,
        tuition: 60000,
        avgSalary: 115000,
        state: 'MA',
        testingPolicy: 'REQUIRED',
        testOptional: false,
      },
    ] as any);

    const result = await service.compareSchools(['ucb', 'mit']);

    expect(result.comparison).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'University of California, Berkeley',
          testingPolicy: 'BLIND',
        }),
        expect.objectContaining({
          name: 'MIT',
          testingPolicy: 'REQUIRED',
        }),
      ]),
    );
  });
});
