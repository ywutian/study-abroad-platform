import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationToolsService } from './recommendation-tools.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { LLMService } from '../core/llm.service';
import { PredictionService } from '../../prediction/prediction.service';
import { RecommendationService } from '../../recommendation/recommendation.service';
import { ProfileLoaderHelper } from './helpers/profile-loader.helper';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';

describe('RecommendationToolsService', () => {
  let service: RecommendationToolsService;
  let predictionService: { predict: jest.Mock };
  let profileLoader: { getProfileId: jest.Mock };
  let schoolLookup: { findSchool: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationToolsService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(null),
          },
        },
        {
          provide: LLMService,
          useValue: {},
        },
        {
          provide: PredictionService,
          useValue: {
            predict: jest.fn(),
          },
        },
        {
          provide: RecommendationService,
          useValue: {
            generateRecommendation: jest.fn(),
          },
        },
        {
          provide: ProfileLoaderHelper,
          useValue: {
            getProfileId: jest.fn().mockResolvedValue('profile-1'),
            loadProfile: jest.fn(),
          },
        },
        {
          provide: SchoolLookupHelper,
          useValue: {
            findSchool: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(RecommendationToolsService);
    predictionService = module.get(PredictionService);
    profileLoader = module.get(ProfileLoaderHelper);
    schoolLookup = module.get(SchoolLookupHelper);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('forwards forceRefresh to PredictionService and preserves enriched prediction fields', async () => {
    schoolLookup.findSchool.mockResolvedValue({
      id: 'school-1',
      name: 'MIT',
      nameZh: '麻省理工学院',
    });
    predictionService.predict.mockResolvedValue({
      results: [
        {
          probability: 0.42,
          confidence: 'high',
          tier: 'match',
          confidenceReason: 'School-specific evidence is strong.',
          cohortKey: 'intl-cs',
          roundContext: 'ED',
          sourceSummary: [{ label: 'IPEDS baseline' }],
          uncertaintyReasons: ['Major sample is limited.'],
          servedPolicyVersionId: 'served-v3',
          source: 'served',
          modelVersion: 'v3-enterprise',
          schoolMeta: { usNewsRank: 2, acceptanceRate: 4.5 },
          factors: [
            { name: 'GPA', impact: 'positive', detail: 'Strong transcript' },
          ],
          suggestions: ['Keep ED strategy'],
          comparison: {
            gpaPercentile: 90,
            testScorePercentile: 85,
            activityStrength: 'strong',
          },
          latestOutcomeLabel: {
            id: 'label-1',
            result: 'ADMITTED',
            status: 'COUNSELOR_VERIFIED',
            reportedAt: '2026-04-10T00:00:00.000Z',
          },
        },
      ],
    });

    const result = await service.analyzeAdmissionChance(
      'user-1',
      { schoolId: 'school-1', forceRefresh: true },
      {},
      'en',
    );

    expect(profileLoader.getProfileId).toHaveBeenCalledWith('user-1');
    expect(predictionService.predict).toHaveBeenCalledWith(
      'profile-1',
      ['school-1'],
      true,
      'en',
    );
    expect(result).toEqual(
      expect.objectContaining({
        school: { id: 'school-1', name: 'MIT', nameZh: '麻省理工学院' },
        probability: 0.42,
        tier: 'match',
        roundContext: 'ED',
        latestOutcomeLabel: expect.objectContaining({
          result: 'ADMITTED',
        }),
      }),
    );
  });
});
