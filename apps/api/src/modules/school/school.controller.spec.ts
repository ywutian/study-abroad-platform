import { Test, TestingModule } from '@nestjs/testing';
import { SchoolController } from './school.controller';
import { SchoolService } from './school.service';
import { SchoolDataService } from './school-data.service';
import { SchoolScraperService } from './school-scraper.service';
import { SchoolDataMerger } from './school-data-merger';
import { LLMService } from '../ai-agent/core/llm.service';
import { ProfileService } from '../profile/profile.service';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { SchoolLogoService } from './school-logo.service';
import { SchoolMediaService } from './school-media.service';
import { SchoolListService } from '../school-list/school-list.service';
import { UrbanInstituteDataService } from './urban-institute-data.service';
import { BigFutureScrapeService } from './scrapers/bigfuture.scraper';
import { AppilyScrapeService } from './scrapers/appily.scraper';
import { SchoolCommunityRatingService } from './school-community-rating.service';

describe('SchoolController', () => {
  let controller: SchoolController;
  let schoolService: SchoolService;
  let schoolDataService: SchoolDataService;
  let schoolScraperService: SchoolScraperService;
  let _llmService: LLMService;
  let _profileService: ProfileService;
  let schoolListService: SchoolListService;
  let redisService: RedisService;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    locale: 'zh',
  };

  const mockSchool = {
    id: 'school-1',
    name: 'MIT',
    nameZh: 'MIT Chinese',
    usNewsRank: 1,
    acceptanceRate: 4,
    sat25: 1510,
    sat75: 1580,
    act25: 34,
    act75: 36,
  };

  const mockSchoolListResult = {
    items: [mockSchool],
    total: 1,
    page: 1,
    pageSize: 10,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchoolController],
      providers: [
        {
          provide: SchoolService,
          useValue: {
            findAll: jest.fn().mockResolvedValue(mockSchoolListResult),
            findById: jest.fn().mockResolvedValue(mockSchool),
            getAvailableRankingLists: jest.fn().mockResolvedValue([
              {
                source: 'US_NEWS',
                list: 'US_NEWS_CORE',
                labelKey: 'core',
                year: 2025,
                count: 2,
                verifiedCount: 2,
                fallbackCount: 0,
                isDefault: true,
              },
            ]),
            create: jest.fn().mockResolvedValue(mockSchool),
            update: jest.fn().mockResolvedValue(mockSchool),
            invalidateSchoolCache: jest.fn().mockResolvedValue(undefined),
            getDataQualityReport: jest.fn().mockResolvedValue({
              summary: {
                total: 100,
                fullyComplete: 50,
                missingCritical: 10,
                averageCompleteness: 75,
              },
              fieldCoverage: {},
              worstSchools: [],
            }),
          },
        },
        {
          provide: SchoolDataService,
          useValue: {
            syncSchoolsFromScorecard: jest
              .fn()
              .mockResolvedValue({ synced: 500 }),
          },
        },
        {
          provide: SchoolScraperService,
          useValue: {
            scrapeAllSchools: jest.fn().mockResolvedValue({ scraped: 10 }),
            getConfiguredSchools: jest
              .fn()
              .mockReturnValue(['MIT', 'Stanford']),
          },
        },
        {
          provide: SchoolDataMerger,
          useValue: {
            merge: jest
              .fn()
              .mockResolvedValue({ updatedFields: [], skippedFields: [] }),
            mergeByName: jest
              .fn()
              .mockResolvedValue({ updatedFields: [], skippedFields: [] }),
            getProvenance: jest.fn().mockResolvedValue(null),
            batchMerge: jest
              .fn()
              .mockResolvedValue({ processed: 0, updated: 0, notFound: 0 }),
          },
        },
        {
          provide: LLMService,
          useValue: {
            chatSimple: jest.fn().mockResolvedValue(''),
            recommendSchools: jest.fn().mockResolvedValue({
              reach: [{ schoolId: 'school-1', reason: 'top' }],
              target: [],
              safety: [],
              summary: 'AI summary',
            }),
          },
        },
        {
          provide: ProfileService,
          useValue: {
            findByUserId: jest.fn().mockResolvedValue({
              gpa: 3.9,
              gpaScale: 4.0,
              targetMajor: 'CS',
            }),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getJSON: jest.fn().mockResolvedValue(null),
            setJSON: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            profile: { findFirst: jest.fn().mockResolvedValue(null) },
            school: {
              findUnique: jest.fn().mockResolvedValue({
                metadata: {},
              }),
            },
            predictionResult: {
              findUnique: jest.fn().mockResolvedValue(null),
              upsert: jest.fn(),
            },
            predictionSnapshot: { create: jest.fn() },
          },
        },
        {
          provide: AuditLogService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: SchoolLogoService,
          useValue: {
            isConfigured: jest.fn().mockReturnValue(false),
            getSuggestedLogoUrl: jest.fn().mockReturnValue(null),
            fillLogosByDomain: jest
              .fn()
              .mockResolvedValue({ filled: 0, failed: 0, skipped: 0 }),
          },
        },
        {
          provide: SchoolMediaService,
          useValue: {
            listAssets: jest.fn().mockResolvedValue({
              items: [],
              total: 0,
              page: 1,
              pageSize: 20,
            }),
            getCoverage: jest.fn().mockResolvedValue({
              totalSchools: 0,
              approvedCampusCovers: 0,
              pendingCampusCovers: 0,
              failedCampusCovers: 0,
              missingCampusCovers: 0,
            }),
            discoverMedia: jest.fn().mockResolvedValue({
              processed: 0,
              created: 0,
              skipped: 0,
              failed: 0,
              results: [],
            }),
            approveAsset: jest.fn().mockResolvedValue({}),
            rejectAsset: jest.fn().mockResolvedValue({}),
            setPrimary: jest.fn().mockResolvedValue({}),
            retryAsset: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: SchoolListService,
          useValue: {
            getRecommendedSchools: jest.fn().mockResolvedValue([]),
            getAIRecommendations: jest
              .fn()
              .mockResolvedValue({ reach: [], target: [], safety: [] }),
          },
        },
        {
          provide: UrbanInstituteDataService,
          useValue: {
            syncAll: jest.fn().mockResolvedValue({
              synced: 10,
              updated: 5,
              failed: 0,
              skipped: 0,
            }),
          },
        },
        {
          provide: BigFutureScrapeService,
          useValue: {
            scrapeSchools: jest.fn().mockResolvedValue({
              scraped: 10,
              updated: 5,
              failed: 0,
              skipped: 0,
            }),
          },
        },
        {
          provide: AppilyScrapeService,
          useValue: {
            scrapeSchools: jest.fn().mockResolvedValue({
              scraped: 10,
              updated: 5,
              failed: 0,
              skipped: 0,
            }),
          },
        },
        {
          provide: SchoolCommunityRatingService,
          useValue: {
            getSummary: jest.fn().mockResolvedValue({
              count: 0,
              safetyAvg: null,
              lifeAvg: null,
              foodAvg: null,
              isPublic: false,
            }),
            getMyRating: jest.fn().mockResolvedValue(null),
            upsertMyRating: jest.fn(),
            getAdminRatings: jest.fn().mockResolvedValue({
              summary: {
                count: 0,
                safetyAvg: null,
                lifeAvg: null,
                foodAvg: null,
                isPublic: false,
              },
              totalCount: 0,
              hiddenCount: 0,
              ratings: [],
            }),
            hideRating: jest.fn(),
            restoreRating: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SchoolController>(SchoolController);
    schoolService = module.get<SchoolService>(SchoolService);
    schoolDataService = module.get<SchoolDataService>(SchoolDataService);
    schoolScraperService =
      module.get<SchoolScraperService>(SchoolScraperService);
    _llmService = module.get<LLMService>(LLMService);
    _profileService = module.get<ProfileService>(ProfileService);
    schoolListService = module.get<SchoolListService>(SchoolListService);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should call schoolService.findAll with pagination and filters', async () => {
      const query = {
        page: 1,
        pageSize: 10,
        country: 'US',
        search: 'MIT',
        rankingSource: 'US_NEWS',
        rankingList: 'MUSIC',
      } as any;

      const result = await controller.findAll(query);

      expect(schoolService.findAll).toHaveBeenCalledWith(
        { page: 1, pageSize: 10 },
        expect.objectContaining({
          country: 'US',
          search: 'MIT',
          rankingSource: 'US_NEWS',
          rankingList: 'MUSIC',
        }),
      );
      expect(result).toEqual(mockSchoolListResult);
    });
  });

  describe('getAvailableRankingLists', () => {
    it('should call schoolService.getAvailableRankingLists', async () => {
      const result = await controller.getAvailableRankingLists();

      expect(schoolService.getAvailableRankingLists).toHaveBeenCalled();
      expect(result[0]).toMatchObject({ list: 'US_NEWS_CORE' });
    });
  });

  describe('findById', () => {
    it('should call schoolService.findById with the id', async () => {
      const result = await controller.findById('school-1');

      expect(schoolService.findById).toHaveBeenCalledWith('school-1');
      expect(result).toEqual(mockSchool);
    });
  });

  describe('getAIRecommendations', () => {
    it('should delegate to schoolListService and return recommendations', async () => {
      const mockRecommendation = {
        reach: [{ schoolId: 'school-1', reason: 'top' }],
        target: [],
        safety: [],
      };
      (schoolListService.getAIRecommendations as jest.Mock).mockResolvedValue(
        mockRecommendation,
      );

      const result = await controller.getAIRecommendations(mockUser);

      expect(schoolListService.getAIRecommendations).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toHaveProperty('reach');
      expect(result).toHaveProperty('target');
      expect(result).toHaveProperty('safety');
      expect(result).toHaveProperty('status', 'fresh');
    });

    it('should return fresh recommendations when Redis cache read/write fails', async () => {
      (redisService.getJSON as jest.Mock).mockRejectedValueOnce(
        new Error('ERR max requests limit exceeded'),
      );
      (redisService.setJSON as jest.Mock).mockRejectedValueOnce(
        new Error('ERR max requests limit exceeded'),
      );

      const result = await controller.getAIRecommendations(mockUser);

      expect(schoolListService.getAIRecommendations).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toHaveProperty('status', 'fresh');
    });
  });

  describe('create', () => {
    it('should call schoolService.create with the dto', async () => {
      const dto = { name: 'MIT', country: 'US' } as any;

      const result = await controller.create(dto, mockUser);

      expect(schoolService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'MIT',
          country: 'US',
          metadata: expect.objectContaining({
            provenance: expect.objectContaining({
              name: expect.objectContaining({
                source: 'MANUAL_ADMIN',
              }),
            }),
          }),
        }),
      );
      expect(result).toEqual(mockSchool);
    });
  });

  describe('update', () => {
    it('should call schoolService.update with id and dto', async () => {
      const dto = { name: 'MIT Updated' } as any;

      const result = await controller.update('school-1', dto, mockUser);

      expect(schoolService.update).toHaveBeenCalledWith(
        'school-1',
        expect.objectContaining({
          name: 'MIT Updated',
          metadata: expect.objectContaining({
            provenance: expect.objectContaining({
              name: expect.objectContaining({
                source: 'MANUAL_ADMIN',
              }),
            }),
          }),
        }),
      );
      expect(result).toEqual(mockSchool);
    });
  });

  describe('syncFromScorecard', () => {
    it('should call schoolDataService.syncSchoolsFromScorecard with limit', async () => {
      const result = await controller.syncFromScorecard(100);

      expect(schoolDataService.syncSchoolsFromScorecard).toHaveBeenCalledWith(
        100,
      );
      expect(result).toEqual({ synced: 500 });
    });

    it('should default to 500 when no limit provided', async () => {
      await controller.syncFromScorecard(undefined);

      expect(schoolDataService.syncSchoolsFromScorecard).toHaveBeenCalledWith(
        500,
      );
    });
  });

  describe('scrapeAllSchools', () => {
    it('should call schoolScraperService.scrapeAllSchools', async () => {
      const result = await controller.scrapeAllSchools();

      expect(schoolScraperService.scrapeAllSchools).toHaveBeenCalled();
      expect(result).toEqual({ scraped: 10 });
    });
  });

  describe('getConfiguredSchools', () => {
    it('should return configured schools with count', async () => {
      const result = controller.getConfiguredSchools();

      expect(schoolScraperService.getConfiguredSchools).toHaveBeenCalled();
      expect(result).toEqual({
        schools: ['MIT', 'Stanford'],
        total: 2,
      });
    });
  });
});
