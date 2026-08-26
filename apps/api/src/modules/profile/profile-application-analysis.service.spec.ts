import { Test, TestingModule } from '@nestjs/testing';
import { ProfileApplicationAnalysisService } from './profile-application-analysis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { PredictionService } from '../prediction/prediction.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { ApplicationAnalysisWorkflowService } from './application-analysis-workflow.service';
import { ProfileApplicationAnalysisV2Service } from './profile-application-analysis-v2.service';

describe('ProfileApplicationAnalysisService', () => {
  let service: ProfileApplicationAnalysisService;
  const originalV2Flag = process.env.APPLICATION_ANALYSIS_V2_ENABLED;

  const mockPrisma = {
    profile: {
      findUnique: jest.fn(),
    },
    schoolListItem: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    predictionResult: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    recommendationLetter: {
      count: jest.fn(),
    },
  };

  const mockRedis = {
    getJSON: jest.fn(),
    setJSON: jest.fn(),
  };

  const mockPredictionService = {
    predictForApplicationAnalysis: jest.fn(),
  };

  const mockLlmService = {
    chatSimpleGuarded: jest.fn(),
  };

  const mockApplicationAnalysisWorkflowService = {
    getActivePolicyVersion: jest.fn(),
    listApprovedEvidenceBySchool: jest.fn(),
    getRuntimeExperiments: jest.fn(),
    recordRuntimeExposure: jest.fn().mockResolvedValue(undefined),
  };

  const mockProfileApplicationAnalysisV2Service = {
    getAnalysisForUser: jest.fn(),
  };

  const profileBase = {
    id: 'profile-1',
    userId: 'user-1',
    gpa: 3.82,
    gpaScale: 4,
    targetMajor: 'Computer Science',
    intendedMajor: 'Computer Science',
    secondMajor: null,
    grade: 'JUNIOR',
    educationSystem: 'US',
    nationality: 'China',
    countryOfResidence: 'China',
    citizenship: 'China',
    legacy: [],
    firstGeneration: false,
    needsFinancialAid: true,
    applicationRound: 'RD',
    updatedAt: new Date('2026-04-09T12:00:00.000Z'),
    testScores: [{ type: 'SAT', score: 1510 }],
    activities: [
      {
        role: 'Founder',
        activityTemplate: { tier: 2 },
      },
    ],
    awards: [{ level: 'NATIONAL' }],
    education: [
      {
        schoolName: 'Test High School',
        schoolType: 'HIGH_SCHOOL',
        highSchoolId: 'hs-1',
        highSchool: {
          name: 'Test High School',
          tier: 4,
          type: 'INTL_CN',
          country: 'China',
          state: 'Shanghai',
        },
      },
    ],
    essays: [],
    semesterGpas: [],
  };

  const schoolListBase = [
    {
      id: 'sl-1',
      schoolId: 'school-1',
      tier: 'REACH',
      round: 'ED',
      updatedAt: new Date('2026-04-09T12:10:00.000Z'),
      school: {
        id: 'school-1',
        name: 'Example University',
        nameZh: '示例大学',
        usNewsRank: 12,
        acceptanceRate: 6.5,
        sat25: 1480,
        sat75: 1560,
        satAvg: 1520,
        testingPolicy: 'OPTIONAL',
        testOptional: true,
        needBlindInternational: false,
        intlAcceptanceRate: 3.2,
      },
    },
  ];

  const predictionBase = [
    {
      schoolId: 'school-1',
      probability: 0.28,
      probabilityLow: 0.22,
      probabilityHigh: 0.35,
      tier: 'reach',
      confidence: 'medium',
      factors: [
        {
          name: 'GPA',
          impact: 'positive',
          detail: 'GPA is above the school median.',
        },
        {
          name: 'Activities',
          impact: 'negative',
          detail: 'Leadership depth is not yet fully differentiated.',
        },
      ],
      suggestions: ['Strengthen one school-specific flagship project.'],
      confidenceReason: 'Enough baseline data for a directional read.',
      applicationRound: 'ED',
      updatedAt: new Date('2026-04-09T11:00:00.000Z'),
    },
  ];

  beforeEach(async () => {
    process.env.APPLICATION_ANALYSIS_V2_ENABLED = 'false';
    jest.clearAllMocks();

    mockPrisma.profile.findUnique.mockImplementation(
      ({ select, include }: any) => {
        if (select?.updatedAt) {
          return Promise.resolve({
            updatedAt: profileBase.updatedAt,
          });
        }
        if (include) {
          return Promise.resolve(profileBase);
        }
        return Promise.resolve(null);
      },
    );
    mockPrisma.schoolListItem.aggregate.mockResolvedValue({
      _count: { _all: schoolListBase.length },
      _max: { updatedAt: schoolListBase[0].updatedAt },
    });
    mockPrisma.schoolListItem.findMany.mockResolvedValue(schoolListBase);
    mockPrisma.predictionResult.count.mockResolvedValue(1);
    mockPrisma.predictionResult.findMany.mockResolvedValue(predictionBase);
    mockPrisma.recommendationLetter.count.mockResolvedValue(0);
    mockRedis.getJSON.mockResolvedValue(null);
    mockRedis.setJSON.mockResolvedValue(undefined);
    mockPredictionService.predictForApplicationAnalysis.mockResolvedValue({
      results: [],
      dataCompleteness: 80,
      memoryContext: {
        previousPredictions: 0,
        knownPreferences: [],
        dataPoints: 0,
      },
    });
    mockLlmService.chatSimpleGuarded.mockResolvedValue(
      JSON.stringify({
        summary:
          'Strong overall candidacy with one visible differentiation gap.',
        portfolioAnalysis: {
          verdict: 'The list is ambitious but still defensible.',
          reasons: ['One focus school already has usable prediction coverage.'],
          riskBoundaries: [
            'International aid need remains the hardest structural constraint.',
          ],
        },
        targetSchoolInsights: [
          {
            schoolId: 'school-1',
            whyThisIsHard: [
              'This remains a reach school even with a usable academic baseline.',
            ],
            compensatingStrengths: [
              'Academic profile already clears the first screening threshold.',
            ],
            topGaps: [
              'Leadership signal still needs sharper external validation.',
            ],
            nextActions: [
              'Convert one flagship activity into a measurable school-facing story.',
            ],
            historicalSignals: [
              'Historical data is thin, so the case signal is limited.',
            ],
            hardStopRisks: ['International aid need narrows the margin.'],
          },
        ],
        actionPlan: {
          now: ['Finalize the ED school story.'],
          next90Days: ['Build one stronger proof point.'],
          beforeSubmission: [
            'Re-check probability after round and essay updates.',
          ],
        },
        recommendedPrograms: {
          majors: ['Computer Science'],
          competitions: ['USACO'],
          activities: ['Independent research project'],
          summerPrograms: ['MITES'],
          timeline: ['Lock one flagship theme before summer.'],
        },
      }),
    );
    mockApplicationAnalysisWorkflowService.getActivePolicyVersion.mockResolvedValue(
      null,
    );
    mockApplicationAnalysisWorkflowService.listApprovedEvidenceBySchool.mockResolvedValue(
      [],
    );
    mockApplicationAnalysisWorkflowService.getRuntimeExperiments.mockResolvedValue(
      [],
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileApplicationAnalysisService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: PredictionService, useValue: mockPredictionService },
        { provide: LLMService, useValue: mockLlmService },
        {
          provide: ApplicationAnalysisWorkflowService,
          useValue: mockApplicationAnalysisWorkflowService,
        },
        {
          provide: ProfileApplicationAnalysisV2Service,
          useValue: mockProfileApplicationAnalysisV2Service,
        },
      ],
    }).compile();

    service = module.get(ProfileApplicationAnalysisService);
  });

  afterAll(() => {
    if (originalV2Flag == null) {
      delete process.env.APPLICATION_ANALYSIS_V2_ENABLED;
      return;
    }
    process.env.APPLICATION_ANALYSIS_V2_ENABLED = originalV2Flag;
  });

  it('returns cached analysis when the cache key hits', async () => {
    mockRedis.getJSON.mockResolvedValueOnce({
      summary: 'cached',
      overallScore: 80,
      tier: 'top30',
      sections: {
        academic: { status: 'green', score: 8, feedback: 'cached' },
        testScores: { status: 'yellow', score: 6, feedback: 'cached' },
        activities: { status: 'green', score: 8, feedback: 'cached' },
        awards: { status: 'yellow', score: 5, feedback: 'cached' },
      },
      suggestions: {
        majors: [],
        competitions: [],
        activities: [],
        summerPrograms: [],
        timeline: [],
      },
    });

    const result = (await service.getAnalysisForUser('user-1', 'en')) as any;

    expect(result.status).toBe('cached');
    expect(mockPrisma.schoolListItem.findMany).not.toHaveBeenCalled();
  });

  it('returns insufficient-profile state when no profile exists', async () => {
    mockPrisma.profile.findUnique.mockImplementation(
      ({ select, include }: any) => {
        if (select?.updatedAt) {
          return Promise.resolve(null);
        }
        if (include) {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      },
    );
    mockPrisma.schoolListItem.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _max: { updatedAt: null },
    });
    mockPrisma.schoolListItem.findMany.mockResolvedValue([]);

    const result = (await service.getAnalysisForUser('user-1', 'en')) as any;

    expect(result.status).toBe('fresh');
    expect(result.meta?.state).toBe('insufficientProfileData');
    expect(result.targetSchoolInsights).toEqual([]);
  });

  it('returns noTargetSchools state when the user has a profile but no school list', async () => {
    mockPrisma.schoolListItem.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _max: { updatedAt: null },
    });
    mockPrisma.schoolListItem.findMany.mockResolvedValue([]);
    mockPrisma.predictionResult.count.mockResolvedValue(0);
    mockPrisma.predictionResult.findMany.mockResolvedValue([]);

    const result = (await service.getAnalysisForUser('user-1', 'en')) as any;

    expect(result.meta?.state).toBe('noTargetSchools');
    expect(
      mockPredictionService.predictForApplicationAnalysis,
    ).not.toHaveBeenCalled();
    expect(result.portfolioAnalysis?.strategyStatus).toBe('noTargetSchools');
  });

  it('returns noPredictions state without fabricating school insights', async () => {
    mockPrisma.predictionResult.count.mockResolvedValue(0);
    mockPrisma.predictionResult.findMany.mockResolvedValue([]);

    const result = (await service.getAnalysisForUser('user-1', 'en')) as any;

    expect(
      mockPredictionService.predictForApplicationAnalysis,
    ).toHaveBeenCalledWith('profile-1', ['school-1'], 'en');
    expect(result.meta?.state).toBe('noPredictions');
    expect(result.portfolioAnalysis?.strategyStatus).toBe('noPredictions');
    expect(result.targetSchoolInsights).toEqual([]);
  });

  it('adds V3 experimental enrichments when runtime experiments are enabled', async () => {
    mockApplicationAnalysisWorkflowService.getRuntimeExperiments.mockResolvedValue(
      [
        {
          capability: 'RECOURSE',
          version: 'recourse-v1',
          status: 'ACTIVE',
          updatedAt: new Date('2026-04-10T12:00:00.000Z'),
          evaluationRuns: [{ metrics: {} }],
        },
        {
          capability: 'UNCERTAINTY',
          version: 'uncertainty-v1',
          status: 'CANARY',
          updatedAt: new Date('2026-04-10T12:00:00.000Z'),
          evaluationRuns: [{ metrics: { medianIntervalWidthDelta: 0.1 } }],
        },
        {
          capability: 'FAIRNESS',
          version: 'fairness-v1',
          status: 'ACTIVE',
          updatedAt: new Date('2026-04-10T12:00:00.000Z'),
          evaluationRuns: [
            { metrics: { disclosurePass: true, blockedSubgroupCount: 0 } },
          ],
        },
      ],
    );

    const result = (await service.getAnalysisForUser('user-1', 'en')) as any;

    expect(result.meta?.experimentalVersions?.length).toBe(3);
    expect(result.targetSchoolInsights?.[0]?.recourseGuidance).toBeDefined();
    expect(result.targetSchoolInsights?.[0]?.strategyUncertainty).toBeDefined();
    expect(result.fairnessDisclosure?.status).toBe('clear');
  });

  it('returns degraded analysis when synthesis throws', async () => {
    mockLlmService.chatSimpleGuarded.mockRejectedValueOnce(
      new Error('LLM timeout'),
    );

    const result = (await service.getAnalysisForUser('user-1', 'en')) as any;

    expect(result.status).toBe('degraded');
    expect(result.meta?.state).toBe('analysisError');
    expect(result.targetSchoolInsights).toEqual([]);
    expect(result.summary).toContain(
      'School-level application analysis is temporarily unavailable',
    );
    expect(result.suggestions.timeline.length).toBeGreaterThan(0);
  });

  it('refreshes focus-school predictions when the prediction is missing', async () => {
    mockPrisma.predictionResult.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValue(predictionBase);

    const result = (await service.getAnalysisForUser('user-1', 'en')) as any;

    expect(
      mockPredictionService.predictForApplicationAnalysis,
    ).toHaveBeenCalledWith('profile-1', ['school-1'], 'en');
    expect(result.meta?.state).toBe('ready');
    expect(result.targetSchoolInsights?.[0]?.historicalSignals).toEqual([]);
    expect(result.targetSchoolInsights?.[0]?.historicalSignals).not.toContain(
      'Historical data is thin, so the case signal is limited.',
    );
    expect(
      result.targetSchoolInsights?.[0].predictionSnapshot?.roundContext,
    ).toBe('ED');
    expect(result.targetSchoolInsights?.[0].policyContext).toEqual({
      testingPolicy: 'OPTIONAL',
      intlAidPolicy: 'NEED_AWARE',
      roundContext: 'ED',
      policySourceQuality: 'DERIVED',
    });
  });

  it('refreshes focus-school predictions when the prediction is older than the profile', async () => {
    mockPrisma.predictionResult.findMany
      .mockResolvedValueOnce([
        {
          ...predictionBase[0],
          updatedAt: new Date('2026-04-08T11:00:00.000Z'),
          applicationRound: 'ED',
        },
      ])
      .mockResolvedValue(predictionBase);

    const result = (await service.getAnalysisForUser('user-1', 'en')) as any;

    expect(
      mockPredictionService.predictForApplicationAnalysis,
    ).toHaveBeenCalledWith('profile-1', ['school-1'], 'en');
    expect(result.meta?.state).toBe('ready');
  });

  it('refreshes focus-school predictions when the prediction is older than the school-list item', async () => {
    mockPrisma.profile.findUnique.mockImplementation(
      ({ select, include }: any) => {
        if (select?.updatedAt) {
          return Promise.resolve({
            updatedAt: new Date('2026-04-09T10:00:00.000Z'),
          });
        }
        if (include) {
          return Promise.resolve({
            ...profileBase,
            updatedAt: new Date('2026-04-09T10:00:00.000Z'),
          });
        }
        return Promise.resolve(null);
      },
    );
    mockPrisma.predictionResult.findMany
      .mockResolvedValueOnce([
        {
          ...predictionBase[0],
          updatedAt: new Date('2026-04-09T11:00:00.000Z'),
          applicationRound: 'ED',
        },
      ])
      .mockResolvedValue(predictionBase);

    const result = (await service.getAnalysisForUser('user-1', 'en')) as any;

    expect(
      mockPredictionService.predictForApplicationAnalysis,
    ).toHaveBeenCalledWith('profile-1', ['school-1'], 'en');
    expect(result.meta?.state).toBe('ready');
  });

  it('refreshes stale focus-school predictions when school list or round changed', async () => {
    mockPrisma.predictionResult.findMany.mockResolvedValueOnce([
      {
        ...predictionBase[0],
        updatedAt: new Date('2026-04-08T11:00:00.000Z'),
        applicationRound: 'RD',
      },
    ]);
    mockPrisma.predictionResult.findMany.mockResolvedValue(predictionBase);

    const result = (await service.getAnalysisForUser('user-1', 'en')) as any;

    expect(
      mockPredictionService.predictForApplicationAnalysis,
    ).toHaveBeenCalledWith('profile-1', ['school-1'], 'en');
    expect(result.meta?.state).toBe('ready');
    expect(
      result.targetSchoolInsights?.[0].predictionSnapshot?.roundContext,
    ).toBe('ED');
  });

  it('marks UC campuses as test-blind in policy context', async () => {
    mockPrisma.profile.findUnique.mockImplementation(
      ({ select, include }: any) => {
        if (select?.updatedAt) {
          return Promise.resolve({
            updatedAt: new Date('2026-04-09T10:00:00.000Z'),
          });
        }
        if (include) {
          return Promise.resolve({
            ...profileBase,
            applicationRound: 'UC',
            updatedAt: new Date('2026-04-09T10:00:00.000Z'),
          });
        }
        return Promise.resolve(null);
      },
    );
    mockPrisma.schoolListItem.findMany.mockResolvedValue([
      {
        ...schoolListBase[0],
        round: 'UC',
        updatedAt: new Date('2026-04-09T10:05:00.000Z'),
        school: {
          ...schoolListBase[0].school,
          name: 'University of California, Berkeley',
          nameZh: '加州大学伯克利分校',
          testingPolicy: 'BLIND',
          testOptional: false,
        },
      },
    ]);
    mockPrisma.predictionResult.findMany.mockResolvedValue([
      {
        ...predictionBase[0],
        applicationRound: 'UC',
        updatedAt: new Date('2026-04-09T10:20:00.000Z'),
      },
    ]);

    const result = (await service.getAnalysisForUser('user-1', 'en')) as any;

    expect(
      mockPredictionService.predictForApplicationAnalysis,
    ).not.toHaveBeenCalled();
    expect(result.targetSchoolInsights?.[0].policyContext).toEqual({
      testingPolicy: 'BLIND',
      intlAidPolicy: 'NEED_AWARE',
      roundContext: 'UC',
      policySourceQuality: 'DERIVED',
    });
  });
});
