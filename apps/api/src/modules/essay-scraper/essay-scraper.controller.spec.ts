import { Test, TestingModule } from '@nestjs/testing';
import { EssayScraperController } from './essay-scraper.controller';
import { EssayScraperService } from './essay-scraper.service';
import { EssayScraperScheduler } from './essay-scraper.scheduler';
import { PrismaService } from '../../prisma/prisma.service';

describe('EssayScraperController', () => {
  let controller: EssayScraperController;
  let scraperService: EssayScraperService;
  let scheduler: EssayScraperScheduler;
  let prisma: PrismaService;

  const mockUser = { id: 'user-1', email: 'test@test.com', role: 'USER' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EssayScraperController],
      providers: [
        {
          provide: EssayScraperService,
          useValue: {
            getConfiguredSchools: jest
              .fn()
              .mockResolvedValue([{ name: 'MIT', slug: 'mit' }]),
            scrapeSchool: jest
              .fn()
              .mockResolvedValue({ school: 'MIT', prompts: [] }),
            scrapeAllSchools: jest.fn().mockResolvedValue({ results: [] }),
            testScrapeSchool: jest.fn().mockResolvedValue({ preview: [] }),
            confirmSave: jest.fn().mockResolvedValue([{ id: 'p1' }]),
          },
        },
        {
          provide: EssayScraperScheduler,
          useValue: {
            runPipeline: jest.fn().mockResolvedValue('run-123'),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            essayPipelineRun: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest
                .fn()
                .mockResolvedValue({ id: 'run-123', status: 'COMPLETED' }),
            },
            school: {
              count: jest.fn().mockResolvedValue(50),
            },
            essayPrompt: {
              groupBy: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(10),
              findMany: jest.fn().mockResolvedValue([]),
            },
            schoolEssaySource: {
              findMany: jest.fn().mockResolvedValue([]),
              create: jest.fn().mockResolvedValue({ id: 'src-1' }),
              update: jest
                .fn()
                .mockResolvedValue({ id: 'src-1', url: 'updated' }),
              delete: jest.fn().mockResolvedValue({ id: 'src-1' }),
            },
          },
        },
      ],
    }).compile();

    controller = module.get<EssayScraperController>(EssayScraperController);
    scraperService = module.get<EssayScraperService>(EssayScraperService);
    scheduler = module.get<EssayScraperScheduler>(EssayScraperScheduler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /schools', () => {
    it('should return configured schools', async () => {
      const result = await controller.getConfiguredSchools();

      expect(scraperService.getConfiguredSchools).toHaveBeenCalled();
      expect(result).toEqual({
        schools: [{ name: 'MIT', slug: 'mit' }],
      });
    });
  });

  describe('POST /scrape', () => {
    it('should scrape a single school', async () => {
      const result = await controller.scrapeSchool({
        schoolName: 'MIT',
        year: 2025,
      });

      expect(scraperService.scrapeSchool).toHaveBeenCalledWith(
        'MIT',
        2025,
        undefined,
      );
      expect(result).toEqual({ school: 'MIT', prompts: [] });
    });
  });

  describe('POST /scrape-all', () => {
    it('should scrape all schools', async () => {
      const result = await controller.scrapeAllSchools(2025);

      expect(scraperService.scrapeAllSchools).toHaveBeenCalledWith(2025);
      expect(result).toEqual({ results: [] });
    });
  });

  describe('POST /test-scrape', () => {
    it('should test-scrape a school without writing to DB', async () => {
      const result = await controller.testScrape({
        schoolName: 'MIT',
        year: 2025,
      } as any);

      expect(scraperService.testScrapeSchool).toHaveBeenCalledWith('MIT', 2025);
      expect(result).toEqual({ preview: [] });
    });
  });

  describe('POST /confirm-save', () => {
    it('should confirm and save scraped data', async () => {
      const dto = { data: [{ title: 'Essay 1' }], selectedIndices: [0] };
      const result = await controller.confirmSave(dto as any);

      expect(scraperService.confirmSave).toHaveBeenCalledWith(
        dto.data,
        dto.selectedIndices,
      );
      expect(result).toEqual({ saved: [{ id: 'p1' }] });
    });
  });

  describe('POST /pipeline/start', () => {
    it('should start the pipeline and return runId', async () => {
      const result = await controller.startPipeline(mockUser as any, {});

      expect(scheduler.runPipeline).toHaveBeenCalledWith('MANUAL', 'user-1');
      expect(result).toEqual({ runId: 'run-123', status: 'RUNNING' });
    });
  });

  describe('GET /pipeline/runs', () => {
    it('should list pipeline runs', async () => {
      const result = await controller.listPipelineRuns(5);

      expect(prisma.essayPipelineRun.findMany).toHaveBeenCalledWith({
        orderBy: { startedAt: 'desc' },
        take: 5,
      });
      expect(result).toEqual([]);
    });
  });

  describe('GET /pipeline/:runId', () => {
    it('should return pipeline run status', async () => {
      const result = await controller.getPipelineStatus('run-123');

      expect(prisma.essayPipelineRun.findUnique).toHaveBeenCalledWith({
        where: { id: 'run-123' },
      });
      expect(result).toEqual({ id: 'run-123', status: 'COMPLETED' });
    });
  });

  describe('GET /dashboard/coverage', () => {
    it('should return coverage stats', async () => {
      const result = await controller.getCoverageStats(2025);

      expect(prisma.school.count).toHaveBeenCalled();
      expect(result).toHaveProperty('year', 2025);
      expect(result).toHaveProperty('totalSchools', 50);
      expect(result).toHaveProperty('coveragePercent');
    });
  });

  describe('GET /dashboard/freshness', () => {
    it('should return freshness data', async () => {
      const result = await controller.getFreshness();

      expect(prisma.schoolEssaySource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
      expect(result).toEqual([]);
    });
  });

  describe('GET /dashboard/changes', () => {
    it('should return yearly changes', async () => {
      const result = await controller.getChanges(2025);

      expect(prisma.essayPrompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            year: 2025,
            changeType: { in: ['MODIFIED', 'NEW'] },
          }),
        }),
      );
      expect(result).toEqual([]);
    });
  });

  describe('GET /sources', () => {
    it('should list all sources', async () => {
      const result = await controller.listSources();

      expect(prisma.schoolEssaySource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ school: expect.any(Object) }),
        }),
      );
      expect(result).toEqual([]);
    });
  });

  describe('POST /sources', () => {
    it('should create a new source', async () => {
      const dto = {
        schoolId: 'school-1',
        sourceType: 'OFFICIAL',
        url: 'https://example.com',
        slug: 'test',
      };
      const result = await controller.addSource(dto as any);

      expect(prisma.schoolEssaySource.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schoolId: 'school-1',
            url: 'https://example.com',
          }),
        }),
      );
      expect(result).toEqual({ id: 'src-1' });
    });
  });

  describe('PUT /sources/:id', () => {
    it('should update an existing source', async () => {
      const dto = { url: 'https://updated.com' };
      const result = await controller.updateSource('src-1', dto as any);

      expect(prisma.schoolEssaySource.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'src-1' },
          data: dto,
        }),
      );
      expect(result).toEqual({ id: 'src-1', url: 'updated' });
    });
  });

  describe('DELETE /sources/:id', () => {
    it('should delete a source', async () => {
      const result = await controller.deleteSource('src-1');

      expect(prisma.schoolEssaySource.delete).toHaveBeenCalledWith({
        where: { id: 'src-1' },
      });
      expect(result).toEqual({ id: 'src-1' });
    });
  });
});
