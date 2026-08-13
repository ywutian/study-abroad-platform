import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { SchoolDataService } from './school-data.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SchoolService } from './school.service';
import { DataSource, SchoolDataMerger } from './school-data-merger';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('SchoolDataService', () => {
  let service: SchoolDataService;

  async function runSyncWithTimers(limit: number) {
    const promise = service.syncSchoolsFromScorecard(limit);
    await jest.runAllTimersAsync();
    return promise;
  }

  const mockPrisma: any = {
    school: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    schoolMetric: {
      upsert: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockSchoolService = {
    invalidateSchoolCache: jest.fn().mockResolvedValue(undefined),
  };
  const mockSchoolDataMerger = {
    merge: jest.fn().mockResolvedValue({
      updatedFields: ['acceptanceRate'],
      skippedFields: [],
    }),
  };

  beforeEach(async () => {
    mockConfigService.get.mockReturnValue('test-api-key');
    mockFetch.mockReset();
    mockPrisma.school.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolDataService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SchoolService, useValue: mockSchoolService },
        { provide: SchoolDataMerger, useValue: mockSchoolDataMerger },
      ],
    }).compile();

    service = module.get<SchoolDataService>(SchoolDataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('syncSchoolsFromScorecard', () => {
    it('targets the Scorecard ids belonging to the requested local schools', async () => {
      mockPrisma.school.findMany.mockResolvedValue([
        { scorecardId: '166027' },
        { scorecardId: null },
        { scorecardId: '110635' },
      ]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await service.syncSchoolsFromScorecardBySchoolIds([
        'school-a',
        'school-b',
        'school-a',
      ]);

      const requestedUrl = new URL(String(mockFetch.mock.calls[0]?.[0]));
      expect(requestedUrl.searchParams.get('id')).toBe('166027,110635');
      expect(requestedUrl.searchParams.has('school.operating')).toBe(false);
      expect(mockPrisma.school.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['school-a', 'school-b'] } },
        select: { scorecardId: true },
      });
    });

    it('should sync schools from College Scorecard API', async () => {
      const apiResponse = {
        results: [
          {
            id: '12345',
            'school.name': 'MIT',
            'school.city': 'Cambridge',
            'school.state': 'MA',
            'school.school_url': 'https://mit.edu',
            'latest.admissions.admission_rate.overall': 0.04,
            'latest.admissions.sat_scores.average.overall': 1540,
            'latest.admissions.sat_scores.25th_percentile.critical_reading': 720,
            'latest.admissions.sat_scores.75th_percentile.critical_reading': 780,
            'latest.admissions.sat_scores.25th_percentile.math': 750,
            'latest.admissions.sat_scores.75th_percentile.math': 800,
            'latest.student.size': 11500,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiResponse),
      });
      // Second page returns empty to stop the loop
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      mockPrisma.school.findUnique.mockResolvedValue(null);
      mockPrisma.school.create.mockResolvedValue({
        id: 'school-new',
        name: 'MIT',
      });
      mockPrisma.schoolMetric.upsert.mockResolvedValue({});

      jest.useFakeTimers();
      const result = await runSyncWithTimers(1);

      expect(result.synced).toBe(1);
      expect(result.errors).toBe(0);
      expect(mockFetch).toHaveBeenCalled();
      expect(mockPrisma.school.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'MIT',
            country: 'US',
            scorecardId: '12345',
            metadata: expect.objectContaining({
              scorecardId: '12345',
              provenance: expect.objectContaining({
                scorecardId: expect.objectContaining({
                  source: 'COLLEGE_SCORECARD',
                }),
              }),
            }),
          }),
        }),
      );
      expect(mockPrisma.schoolMetric.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            schoolId_year_metricKey: expect.objectContaining({
              schoolId: 'school-new',
              metricKey: 'avg_sat',
            }),
          },
        }),
      );
      expect(mockSchoolDataMerger.merge).toHaveBeenCalledWith(
        'school-new',
        expect.objectContaining({
          name: 'MIT',
          state: 'MA',
          city: 'Cambridge',
          website: 'https://mit.edu',
          studentCount: 11500,
        }),
        DataSource.COLLEGE_SCORECARD,
      );
    });

    it('should throw when API key is not configured', async () => {
      // Create a new service instance without API key
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SchoolDataService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: SchoolService, useValue: mockSchoolService },
          { provide: SchoolDataMerger, useValue: mockSchoolDataMerger },
        ],
      }).compile();

      const svcNoKey = module.get<SchoolDataService>(SchoolDataService);

      await expect(svcNoKey.syncSchoolsFromScorecard()).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw when API returns non-OK response', async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
      });

      await expect(service.syncSchoolsFromScorecard(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should stop syncing when limit is reached', async () => {
      jest.useFakeTimers();
      const apiResponse = {
        results: Array.from({ length: 100 }, (_, i) => ({
          id: String(i),
          'school.name': `School ${i}`,
        })),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(apiResponse),
      });
      mockPrisma.school.findUnique.mockResolvedValue(null);
      mockPrisma.school.create.mockImplementation(async ({ data }: any) => ({
        id: `school-${data.scorecardId}`,
        name: data.name,
      }));
      mockPrisma.schoolMetric.upsert.mockResolvedValue({});

      const result = await runSyncWithTimers(5);

      expect(result.synced).toBe(5);
      expect(mockPrisma.school.create).toHaveBeenCalledTimes(5);
    });

    it('should count errors but continue processing', async () => {
      jest.useFakeTimers();
      const apiResponse = {
        results: [
          { id: '1', 'school.name': 'Good School' },
          { id: '2', 'school.name': 'Bad School' },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiResponse),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      mockPrisma.school.findUnique.mockResolvedValue(null);
      mockPrisma.school.create
        .mockResolvedValueOnce({ id: 'id-1', name: 'Good School' })
        .mockRejectedValueOnce(new Error('DB constraint violation'));
      mockPrisma.schoolMetric.upsert.mockResolvedValue({});

      const result = await runSyncWithTimers(10);

      expect(result.synced).toBe(1);
      expect(result.errors).toBe(1);
    });
  });

  describe('getSchoolDetails', () => {
    it('should return school details from Scorecard API', async () => {
      const schoolDetail = { id: '12345', 'school.name': 'MIT' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [schoolDetail] }),
      });

      const result = await service.getSchoolDetails('12345');

      expect(result).toEqual(schoolDetail);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('id=12345'),
      );
    });

    it('should throw when API key is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SchoolDataService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: SchoolService, useValue: mockSchoolService },
          { provide: SchoolDataMerger, useValue: mockSchoolDataMerger },
        ],
      }).compile();

      const svcNoKey = module.get<SchoolDataService>(SchoolDataService);

      await expect(svcNoKey.getSchoolDetails('12345')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should return null when school not found in API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      const result = await service.getSchoolDetails('nonexistent');

      expect(result).toBeNull();
    });
  });
});
