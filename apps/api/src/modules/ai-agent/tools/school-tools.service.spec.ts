import { Test, TestingModule } from '@nestjs/testing';
import { SchoolToolsService } from './school-tools.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';
import { verifySchoolFacts } from '../core/workflow-verification';
import type { ConversationState } from '../types';

describe('SchoolToolsService', () => {
  let service: SchoolToolsService;
  let schoolLookup: jest.Mocked<SchoolLookupHelper>;
  let prisma: {
    school: { findUnique: jest.Mock; findMany: jest.Mock };
    essayPrompt: { findMany: jest.Mock };
    schoolDeadline: { findMany: jest.Mock };
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
      schoolDeadline: {
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

  it.each([
    ['3.4%', 'verified'],
    ['3.5%', 'conflict'],
  ] as const)(
    'verifies the real sourced-percent tool projection for %s',
    async (rate, status) => {
      const acceptanceRate = service['formatSourcedPercentFact'](
        {
          acceptanceRate: 3.4,
          metadata: {
            provenance: {
              acceptanceRate: {
                source: 'SYNTHETIC_CDS',
                tier: 'OFFICIAL',
                fetchedAt: new Date().toISOString(),
                staleness: 'FRESH',
              },
            },
          },
        },
        'acceptanceRate',
      );
      const result = await verifySchoolFacts(
        [
          {
            claim: `Synthetic acceptance rate is ${rate}`,
            schoolName: 'Synthetic',
            field: 'acceptanceRate',
          },
        ],
        {
          execute: jest
            .fn()
            .mockResolvedValue({ success: true, result: { acceptanceRate } }),
        },
        { userId: 'synthetic', context: {} } as ConversationState,
        'en',
        5,
      );
      expect(result.status).toBe(status);
      if (status === 'conflict')
        expect(result.corrections[0].actual).toBe('acceptanceRate: 3.4%');
    },
  );

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

    const result = (await service.getSchoolDetails('ucb')) as any;

    expect(result.testingPolicy).toBe('BLIND');
    expect(result.testOptional).toBe(false);
    expect(result.acceptanceRate).toEqual(
      expect.objectContaining({
        value: null,
        displayValue: 'N/A',
        source: null,
        consumerPolicy: 'hidden_until_field_provenance_exists',
      }),
    );
  });

  it('requires source-backed verified prompts for school details', async () => {
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
      metadata: {},
    } as any);
    prisma.essayPrompt.findMany.mockResolvedValue([
      {
        id: 'p1',
        prompt: 'Describe your community.',
        promptZh: null,
        type: 'SUPPLEMENTAL',
        wordLimit: 350,
        isRequired: true,
        aiTips: 'Use concrete examples.',
        year: 2026,
        sources: [
          {
            sourceType: 'OFFICIAL',
            sourceUrl: 'https://admissions.berkeley.edu/essays',
            scrapedAt: new Date('2026-01-01T00:00:00Z'),
            confidence: 0.91,
          },
        ],
      },
    ]);

    const result = (await service.getSchoolDetails('ucb')) as any;

    expect(prisma.essayPrompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: 'ucb',
          isActive: true,
          status: 'VERIFIED',
          sources: { some: { sourceUrl: { not: null } } },
        }),
        select: expect.objectContaining({
          id: true,
          prompt: true,
          promptZh: true,
          sources: expect.any(Object),
        }),
      }),
    );
    expect(result.essayPrompts[0]).not.toHaveProperty('sources');
    expect(result.essayPrompts[0].sourceSummary).toEqual(
      expect.objectContaining({
        hasSourceEvidence: true,
        sourceUrls: ['https://admissions.berkeley.edu/essays'],
        sourceQuality: 'official',
      }),
    );
  });

  it('exposes campus cover and program rate source policies for school details', async () => {
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
      metadata: {
        provenance: {
          programRates: {
            source: 'OFFICIAL_DEPARTMENT_PAGE',
            sourceUrl: 'https://engineering.berkeley.edu/academics',
            tier: 'OFFICIAL',
            fetchedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      },
      mediaAssets: [
        {
          storageUrl: 'https://cdn.example.edu/berkeley-cover.jpg',
          originalUrl: 'https://upload.wikimedia.org/example.jpg',
          sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Berkeley.jpg',
          sourceType: 'WIKIMEDIA_COMMONS',
          license: 'CC BY-SA 4.0',
          attribution: 'Example photographer',
          width: 1600,
          height: 900,
        },
      ],
      programs: [
        {
          cipCode: '14.0901',
          programName: 'Computer Engineering',
          programNameZh: null,
          competitiveness: 5,
          acceptanceRateEstimate: '8.5',
          medianEarnings: 120000,
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
    } as any);

    const result = (await service.getSchoolDetails('ucb')) as any;

    expect(prisma.school.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          mediaAssets: expect.objectContaining({
            where: expect.objectContaining({
              type: 'CAMPUS_COVER',
              status: 'APPROVED',
              isPrimary: true,
            }),
          }),
          programs: expect.objectContaining({
            select: expect.objectContaining({
              acceptanceRateEstimate: true,
              cipCode: true,
            }),
          }),
        }),
      }),
    );
    expect(result.campusCover).toEqual(
      expect.objectContaining({
        url: 'https://cdn.example.edu/berkeley-cover.jpg',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Berkeley.jpg',
        sourceQuality: 'approved_media_source',
        consumerPolicy: 'use_with_media_source_provenance',
      }),
    );
    expect(result.programRates).toEqual(
      expect.objectContaining({
        source: expect.objectContaining({
          sourceUrl: 'https://engineering.berkeley.edu/academics',
        }),
        sourceQuality: 'field_provenance_present',
        consumerPolicy: 'use_with_program_rate_provenance',
      }),
    );
    expect(result.programRates.programs[0]).toEqual(
      expect.objectContaining({
        cipCode: '14.0901',
        acceptanceRateEstimate: 8.5,
      }),
    );
  });

  it('does not turn metadata deadlines into sourced school detail deadlines', async () => {
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
      metadata: { deadlines: { rd: '2099-01-01' } },
    } as any);
    prisma.schoolDeadline.findMany.mockResolvedValue([]);

    const result = (await service.getSchoolDetails('ucb')) as any;

    expect(prisma.schoolDeadline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: 'ucb',
          source: { not: 'MANUAL' },
          notes: { contains: 'source:' },
        }),
      }),
    );
    expect(result.deadlines).toEqual({});
    expect(result.deadlineSourcePolicy).toBe(
      'no_source_backed_current_year_deadlines',
    );
  });

  it('exposes structured sourced deadlines when evidence is present', async () => {
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
      metadata: { deadlines: { rd: '2099-01-01' } },
    } as any);
    prisma.schoolDeadline.findMany.mockResolvedValue([
      {
        round: 'RD',
        year:
          new Date().getMonth() >= 7
            ? new Date().getFullYear() + 1
            : new Date().getFullYear(),
        applicationDeadline: new Date('2099-01-01T00:00:00.000Z'),
        financialAidDeadline: null,
        decisionDate: null,
        source: 'SCRAPED',
        notes: 'source: https://admissions.berkeley.edu/deadlines',
      },
    ]);

    const result = (await service.getSchoolDetails('ucb')) as any;

    expect(result.deadlines.RD).toEqual(
      expect.objectContaining({
        date: '2099-01-01T00:00:00.000Z',
        source: 'SCRAPED',
        sourceUrl: 'https://admissions.berkeley.edu/deadlines',
      }),
    );
    expect(result.deadlineSourcePolicy).toBe(
      'source_backed_structured_deadlines',
    );
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
        metadata: {
          provenance: {
            acceptanceRate: {
              source: 'COLLEGE_SCORECARD',
              fetchedAt: '2026-01-01T00:00:00.000Z',
              sourceUrl: 'https://collegescorecard.ed.gov/school/?110635',
              tier: 'OFFICIAL',
            },
          },
        },
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
        metadata: {},
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
          acceptanceRate: expect.objectContaining({
            value: 11,
            source: expect.objectContaining({
              source: 'COLLEGE_SCORECARD',
              sourceUrl: 'https://collegescorecard.ed.gov/school/?110635',
            }),
          }),
        }),
        expect.objectContaining({
          name: 'MIT',
          testingPolicy: 'REQUIRED',
          acceptanceRate: expect.objectContaining({
            value: null,
            source: null,
          }),
        }),
      ]),
    );
  });
});
