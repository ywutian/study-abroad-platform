import { Test, TestingModule } from '@nestjs/testing';
import { PredictionToolsService } from './prediction-tools.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileLoaderHelper } from './helpers/profile-loader.helper';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';
import { PredictionReportingService } from '../../prediction/prediction-reporting.service';

describe('PredictionToolsService', () => {
  let service: PredictionToolsService;
  let prisma: {
    predictionResult: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    predictionSnapshot: {
      findMany: jest.Mock;
    };
    school: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    schoolListItem: {
      findMany: jest.Mock;
    };
  };
  let profileLoader: jest.Mocked<ProfileLoaderHelper>;
  let schoolLookup: jest.Mocked<SchoolLookupHelper>;
  let reporting: jest.Mocked<PredictionReportingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionToolsService,
        {
          provide: PrismaService,
          useValue: {
            predictionResult: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
            predictionSnapshot: {
              findMany: jest.fn(),
            },
            school: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
            schoolListItem: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: ProfileLoaderHelper,
          useValue: {
            getProfileId: jest.fn().mockResolvedValue('profile-1'),
          },
        },
        {
          provide: SchoolLookupHelper,
          useValue: {
            findSchool: jest.fn(),
          },
        },
        {
          provide: PredictionReportingService,
          useValue: {
            resolveCanonicalOutcome: jest.fn().mockReturnValue({
              canonicalRecord: null,
              displayRecord: {
                id: 'label-1',
                result: 'ADMITTED',
                status: 'COUNSELOR_VERIFIED',
                notes: null,
                evidenceUrl: null,
                round: 'RD',
                createdAt: new Date('2026-04-10T00:00:00.000Z'),
                resolvedAt: new Date('2026-04-10T00:00:00.000Z'),
              },
              canonicalOutcomeLabel: 'ADMITTED',
              eligibleForCalibration: true,
            }),
            mapLatestOutcomeLabel: jest.fn().mockReturnValue({
              id: 'label-1',
              result: 'ADMITTED',
              status: 'COUNSELOR_VERIFIED',
              round: 'RD',
              reportedAt: '2026-04-10T00:00:00.000Z',
              resolvedAt: '2026-04-10T00:00:00.000Z',
            }),
          },
        },
      ],
    }).compile();

    service = module.get(PredictionToolsService);
    prisma = module.get(PrismaService);
    profileLoader = module.get(ProfileLoaderHelper);
    schoolLookup = module.get(SchoolLookupHelper);
    reporting = module.get(PredictionReportingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns safe public trace fields without exposing raw servedTrace', async () => {
    schoolLookup.findSchool.mockResolvedValue({
      id: 'school-1',
      name: 'MIT',
      nameZh: '麻省理工学院',
    } as any);
    prisma.predictionResult.findUnique.mockResolvedValue({
      probability: 0.37,
      tier: 'reach',
      confidence: 'medium',
      confidenceReason:
        'Profile is strong but round-specific evidence is limited.',
      applicationRound: 'ED',
      sourceSummary: [{ label: 'IPEDS baseline' }],
      uncertaintyReasons: ['Round-specific public data is limited.'],
      policyVersionId: 'served-v3',
      modelVersion: 'v3-enterprise',
      source: 'served',
      updatedAt: new Date('2026-04-10T02:00:00.000Z'),
      servedTrace: { hidden: true },
      outcomeLabelRecords: [{}],
    });

    const result = await service.getPredictionTraceSummary(
      'user-1',
      { schoolId: 'school-1' },
      'en',
    );

    expect(result).toEqual({
      school: { id: 'school-1', name: 'MIT', nameZh: '麻省理工学院' },
      current: {
        probability: 0.37,
        tier: 'reach',
        confidence: 'medium',
        updatedAt: new Date('2026-04-10T02:00:00.000Z'),
      },
      trace: expect.objectContaining({
        source: 'served',
        modelVersion: 'v3-enterprise',
        servedPolicyVersionId: 'served-v3',
        roundContext: 'ED',
        sourceSummary: [{ label: 'IPEDS baseline' }],
        uncertaintyReasons: ['Round-specific public data is limited.'],
        confidenceReason:
          'Profile is strong but round-specific evidence is limited.',
        latestOutcomeLabel: expect.objectContaining({
          result: 'ADMITTED',
          status: 'COUNSELOR_VERIFIED',
        }),
      }),
    });
    expect((result as Record<string, unknown>).servedTrace).toBeUndefined();
    expect(reporting.resolveCanonicalOutcome).toHaveBeenCalled();
  });

  it('enriches dashboard predictions with school context and latest outcome label', async () => {
    prisma.predictionResult.findMany.mockResolvedValue([
      {
        schoolId: 'school-1',
        probability: 0.62,
        tier: 'match',
        confidence: 'high',
        confidenceReason: 'Rich school-specific signal coverage.',
        applicationRound: 'RD',
        sourceSummary: [{ label: 'IPEDS baseline' }],
        uncertaintyReasons: [],
        policyVersionId: 'served-v3',
        source: 'served',
        modelVersion: 'v3-enterprise',
        updatedAt: new Date('2026-04-10T03:00:00.000Z'),
        outcomeLabelRecords: [{}],
      },
    ]);
    prisma.school.findMany.mockResolvedValue([
      {
        id: 'school-1',
        name: 'Stanford University',
        nameZh: '斯坦福大学',
        usNewsRank: 3,
        acceptanceRate: 4.3,
        intlAcceptanceRate: 2.1,
        intlStudentPct: 12.5,
        needBlindInternational: false,
        rankings: [],
      },
    ]);

    const result = await service.getPredictionDashboard('user-1', 'en');

    expect(profileLoader.getProfileId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(
      expect.objectContaining({
        totalSchools: 1,
        avgProbability: 62,
        predictions: [
          expect.objectContaining({
            schoolId: 'school-1',
            probability: 0.62,
            roundContext: 'RD',
            school: expect.objectContaining({
              name: 'Stanford University',
              acceptanceRate: 4.3,
              intlAcceptanceRate: 2.1,
              intlStudentPct: 12.5,
            }),
            latestOutcomeLabel: expect.objectContaining({
              result: 'ADMITTED',
            }),
          }),
        ],
      }),
    );
  });

  it('formats prediction history with current outcome label and snapshot trail', async () => {
    schoolLookup.findSchool.mockResolvedValue({
      id: 'school-1',
      name: 'MIT',
      nameZh: '麻省理工学院',
    } as any);
    prisma.school.findUnique.mockResolvedValue({
      id: 'school-1',
      name: 'MIT',
      nameZh: '麻省理工学院',
      usNewsRank: 2,
      acceptanceRate: 4.5,
      intlAcceptanceRate: 2.2,
      intlStudentPct: 11.5,
      needBlindInternational: false,
      rankings: [],
    });
    prisma.predictionResult.findUnique.mockResolvedValue({
      probability: 0.44,
      tier: 'match',
      confidence: 'high',
      confidenceReason: 'Current school-specific evidence is strong.',
      cohortKey: 'intl-cs',
      applicationRound: 'ED',
      sourceSummary: [{ label: 'IPEDS baseline' }],
      uncertaintyReasons: ['Major-level public sample is limited.'],
      policyVersionId: 'served-v3',
      source: 'served',
      modelVersion: 'v3-enterprise',
      updatedAt: new Date('2026-04-10T03:00:00.000Z'),
      outcomeLabelRecords: [{}],
    });
    prisma.predictionSnapshot.findMany.mockResolvedValue([
      {
        probability: 0.39,
        tier: 'reach',
        confidence: 'medium',
        confidenceReason: 'Earlier baseline was weaker.',
        cohortKey: 'intl-cs',
        applicationRound: 'RD',
        sourceSummary: [{ label: 'IPEDS baseline' }],
        uncertaintyReasons: ['Older public sample.'],
        policyVersionId: 'served-v2',
        source: 'served',
        modelVersion: 'v3-enterprise',
        createdAt: new Date('2026-03-10T03:00:00.000Z'),
      },
    ]);

    const result = await service.getPredictionHistory(
      'user-1',
      { schoolId: 'school-1' },
      'en',
    );

    expect(result).toEqual({
      school: expect.objectContaining({
        id: 'school-1',
        name: 'MIT',
        acceptanceRate: 4.5,
      }),
      current: expect.objectContaining({
        probability: 0.44,
        roundContext: 'ED',
        latestOutcomeLabel: expect.objectContaining({
          result: 'ADMITTED',
        }),
      }),
      history: [
        expect.objectContaining({
          probability: 0.39,
          roundContext: 'RD',
          servedPolicyVersionId: 'served-v2',
        }),
      ],
    });
  });

  it('returns school list predictions with nested prediction payloads', async () => {
    prisma.schoolListItem.findMany.mockResolvedValue([
      {
        schoolId: 'school-1',
        tier: 'target',
        isAIRecommended: true,
        school: {
          id: 'school-1',
          name: 'MIT',
          nameZh: '麻省理工学院',
          usNewsRank: 2,
        },
      },
      {
        schoolId: 'school-2',
        tier: 'reach',
        isAIRecommended: false,
        school: {
          id: 'school-2',
          name: 'Stanford',
          nameZh: null,
          usNewsRank: 3,
        },
      },
    ]);
    prisma.predictionResult.findMany.mockResolvedValue([
      {
        schoolId: 'school-1',
        probability: 0.41,
        tier: 'match',
        confidence: 'high',
        confidenceReason: 'School-specific signal is strong.',
        applicationRound: 'ED',
        sourceSummary: [{ label: 'IPEDS baseline' }],
        uncertaintyReasons: [],
        policyVersionId: 'served-v3',
        source: 'served',
        modelVersion: 'v3-enterprise',
        updatedAt: new Date('2026-04-10T03:00:00.000Z'),
        outcomeLabelRecords: [{}],
      },
    ]);

    const result = await service.getSchoolListPredictions('user-1', 'en');

    expect(result).toEqual([
      expect.objectContaining({
        schoolId: 'school-1',
        school: expect.objectContaining({
          name: 'MIT',
          nameZh: '麻省理工学院',
        }),
        prediction: expect.objectContaining({
          probability: 0.41,
          latestOutcomeLabel: expect.objectContaining({
            result: 'ADMITTED',
          }),
        }),
      }),
      expect.objectContaining({
        schoolId: 'school-2',
        prediction: null,
      }),
    ]);
  });
});
