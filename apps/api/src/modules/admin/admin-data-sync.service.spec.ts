import { Test, TestingModule } from '@nestjs/testing';
import { AdminDataSyncService } from './admin-data-sync.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchoolDataService } from '../school/school-data.service';
import { UrbanInstituteDataService } from '../school/urban-institute-data.service';
import { BigFutureScrapeService } from '../school/scrapers/bigfuture.scraper';
import { AppilyScrapeService } from '../school/scrapers/appily.scraper';
import { BadRequestException } from '@nestjs/common';

describe('AdminDataSyncService', () => {
  let service: AdminDataSyncService;
  let prisma: PrismaService;

  const mockPrisma = {
    auditLog: {
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockSchoolDataService = {
    syncSchoolsFromScorecard: jest
      .fn()
      .mockResolvedValue({ synced: 10, errors: 0 }),
  };

  const mockUrbanInstituteService = {
    syncAll: jest.fn().mockResolvedValue({ total: { synced: 5, errors: 0 } }),
  };

  const mockBigFutureService = {
    scrapeSchools: jest
      .fn()
      .mockResolvedValue({ scraped: 10, updated: 8, failed: 2 }),
  };

  const mockAppilyService = {
    scrapeSchools: jest
      .fn()
      .mockResolvedValue({ scraped: 10, updated: 7, failed: 3 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDataSyncService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: SchoolDataService, useValue: mockSchoolDataService },
        {
          provide: UrbanInstituteDataService,
          useValue: mockUrbanInstituteService,
        },
        { provide: BigFutureScrapeService, useValue: mockBigFutureService },
        { provide: AppilyScrapeService, useValue: mockAppilyService },
      ],
    }).compile();

    service = module.get<AdminDataSyncService>(AdminDataSyncService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDataSyncJobs', () => {
    it('should return all configured jobs', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const jobs = await service.getDataSyncJobs();

      expect(jobs.length).toBeGreaterThanOrEqual(4);
      expect(jobs[0]).toHaveProperty('id');
      expect(jobs[0]).toHaveProperty('name');
      expect(jobs[0]).toHaveProperty('description');
    });

    it('should include last run info from audit log', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue({
        createdAt: new Date(),
        metadata: { successCount: 10, errorCount: 0 },
      });

      const jobs = await service.getDataSyncJobs();

      expect(jobs[0].lastRunStatus).toBe('success');
      expect(jobs[0].lastRunAt).toBeDefined();
    });
  });

  describe('triggerDataSync', () => {
    it('should throw BadRequestException for unknown job', async () => {
      await expect(
        service.triggerDataSync('UNKNOWN_JOB', undefined, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should trigger COLLEGE_SCORECARD sync', async () => {
      const result = await service.triggerDataSync(
        'COLLEGE_SCORECARD',
        { limit: 10 },
        'admin-1',
      );

      expect(result.synced).toBe(10);
      expect(mockSchoolDataService.syncSchoolsFromScorecard).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'admin.job.completed',
        expect.any(Object),
      );
    });

    it('should handle reminder jobs gracefully', async () => {
      const result = await service.triggerDataSync(
        'IPEDS_CHECK',
        undefined,
        'admin-1',
      );

      expect(result.message).toContain('Reminder');
    });
  });
});
