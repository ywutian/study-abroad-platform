import { Test, TestingModule } from '@nestjs/testing';
import { SchoolController } from './school.controller';
import { SchoolService } from './school.service';
import { SchoolDataService } from './school-data.service';
import { SchoolScraperService } from './school-scraper.service';
import { AiService } from '../ai/ai.service';
import { ProfileService } from '../profile/profile.service';

describe('SchoolController', () => {
  let controller: SchoolController;
  let schoolService: SchoolService;
  let schoolDataService: SchoolDataService;
  let schoolScraperService: SchoolScraperService;
  let aiService: AiService;
  let profileService: ProfileService;

  const mockUser = { id: 'user-1', email: 'test@test.com', role: 'USER' };

  const mockSchool = {
    id: 'school-1',
    name: 'MIT',
    nameZh: 'MIT Chinese',
    usNewsRank: 1,
    acceptanceRate: 0.04,
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
            create: jest.fn().mockResolvedValue(mockSchool),
            update: jest.fn().mockResolvedValue(mockSchool),
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
          provide: AiService,
          useValue: {
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
      ],
    }).compile();

    controller = module.get<SchoolController>(SchoolController);
    schoolService = module.get<SchoolService>(SchoolService);
    schoolDataService = module.get<SchoolDataService>(SchoolDataService);
    schoolScraperService =
      module.get<SchoolScraperService>(SchoolScraperService);
    aiService = module.get<AiService>(AiService);
    profileService = module.get<ProfileService>(ProfileService);
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
      } as any;

      const result = await controller.findAll(query);

      expect(schoolService.findAll).toHaveBeenCalledWith(
        { page: 1, pageSize: 10 },
        expect.objectContaining({ country: 'US', search: 'MIT' }),
      );
      expect(result).toEqual(mockSchoolListResult);
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
    it('should fetch profile, schools, and return AI recommendations', async () => {
      const result = await controller.getAIRecommendations(mockUser as any);

      expect(profileService.findByUserId).toHaveBeenCalledWith('user-1');
      expect(schoolService.findAll).toHaveBeenCalledWith(
        { page: 1, pageSize: 100 },
        {},
      );
      expect(aiService.recommendSchools).toHaveBeenCalled();
      expect(result).toHaveProperty('reach');
      expect(result).toHaveProperty('target');
      expect(result).toHaveProperty('safety');
      expect(result).toHaveProperty('summary', 'AI summary');
    });
  });

  describe('create', () => {
    it('should call schoolService.create with the dto', async () => {
      const dto = { name: 'MIT', country: 'US' } as any;

      const result = await controller.create(dto);

      expect(schoolService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockSchool);
    });
  });

  describe('update', () => {
    it('should call schoolService.update with id and dto', async () => {
      const dto = { name: 'MIT Updated' } as any;

      const result = await controller.update('school-1', dto);

      expect(schoolService.update).toHaveBeenCalledWith('school-1', dto);
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
      const result = await controller.getConfiguredSchools();

      expect(schoolScraperService.getConfiguredSchools).toHaveBeenCalled();
      expect(result).toEqual({
        schools: ['MIT', 'Stanford'],
        total: 2,
      });
    });
  });
});
