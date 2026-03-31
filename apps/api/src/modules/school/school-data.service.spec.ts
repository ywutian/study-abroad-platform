import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { SchoolDataService } from './school-data.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SchoolService } from './school.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('SchoolDataService', () => {
  let service: SchoolDataService;

  const mockPrisma: any = {
    school: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    schoolMetric: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockSchoolService = {
    invalidateSchoolCache: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    mockConfigService.get.mockReturnValue('test-api-key');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolDataService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SchoolService, useValue: mockSchoolService },
      ],
    }).compile();

    service = module.get<SchoolDataService>(SchoolDataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('syncSchoolsFromScorecard', () => {
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

      // Mock $transaction to execute the callback
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: any) => Promise<any>) => {
          const tx = {
            school: {
              findUnique: jest.fn().mockResolvedValue(null),
              create: jest
                .fn()
                .mockResolvedValue({ id: 'school-new', name: 'MIT' }),
            },
            schoolMetric: {
              upsert: jest.fn().mockResolvedValue({}),
            },
          };
          return fn(tx);
        },
      );

      const result = await service.syncSchoolsFromScorecard(1);

      expect(result.synced).toBe(1);
      expect(result.errors).toBe(0);
      expect(mockFetch).toHaveBeenCalled();
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

      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: any) => Promise<any>) => {
          const tx = {
            school: {
              findUnique: jest.fn().mockResolvedValue(null),
              create: jest
                .fn()
                .mockResolvedValue({ id: 'new-id', name: 'School' }),
            },
            schoolMetric: { upsert: jest.fn().mockResolvedValue({}) },
          };
          return fn(tx);
        },
      );

      const result = await service.syncSchoolsFromScorecard(5);

      expect(result.synced).toBe(5);
    });

    it('should count errors but continue processing', async () => {
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

      let callCount = 0;
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: any) => Promise<any>) => {
          callCount++;
          if (callCount === 2) {
            throw new Error('DB constraint violation');
          }
          const tx = {
            school: {
              findUnique: jest.fn().mockResolvedValue(null),
              create: jest
                .fn()
                .mockResolvedValue({ id: 'id-1', name: 'Good School' }),
            },
            schoolMetric: { upsert: jest.fn().mockResolvedValue({}) },
          };
          return fn(tx);
        },
      );

      const result = await service.syncSchoolsFromScorecard(10);

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
