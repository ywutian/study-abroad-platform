import { BenchmarkService } from './benchmark.service';

describe('BenchmarkService', () => {
  const prisma = {
    benchmarkProfile: {
      findUnique: jest.fn(),
    },
    competitorSource: {
      findUnique: jest.fn(),
    },
    competitorRun: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const adapterRegistry = {
    getSourceOrThrow: jest.fn(),
    getAdapterOrThrow: jest.fn(),
    hasSession: jest.fn(),
  };
  const browserRunner = {
    withPage: jest.fn(),
  };
  const evaluator = {
    normalizeProfileInput: jest.fn((value) => value),
    evaluateSchool: jest.fn(),
  };
  const schoolMatcher = {
    loadSchoolIndex: jest.fn(),
  };

  let service: BenchmarkService;

  beforeEach(() => {
    process.env.BENCHMARK_ENABLED = 'true';
    service = new BenchmarkService(
      prisma as never,
      adapterRegistry as never,
      browserRunner as never,
      evaluator as never,
      schoolMatcher as never,
    );
    jest.clearAllMocks();
  });

  it('builds summary metrics with probability rows and tier-only rows', async () => {
    prisma.competitorRun.findUnique.mockResolvedValue({
      id: 'run-1',
      profileId: 'profile-1',
      status: 'COMPLETED',
      profile: {
        id: 'profile-1',
        label: 'Test Profile',
        profileJson: { testScores: [], activities: [], awards: [] },
      },
      source: {
        key: 'mock',
        label: 'Mock Competitor',
      },
      predictions: [
        {
          id: 'prediction-1',
          schoolKey: 'mit',
          rawSchoolName: 'MIT',
          schoolId: 'mit',
          school: {
            id: 'mit',
            name: 'Massachusetts Institute of Technology',
            nameZh: null,
          },
          probability: 0.2,
          tierLabel: 'reach',
          status: 'COMPLETED',
          errorMsg: null,
        },
        {
          id: 'prediction-2',
          schoolKey: 'umich',
          rawSchoolName: 'University of Michigan',
          schoolId: 'umich',
          school: {
            id: 'umich',
            name: 'University of Michigan',
            nameZh: null,
          },
          probability: null,
          tierLabel: 'match',
          status: 'TIER_ONLY',
          errorMsg: null,
        },
        {
          id: 'prediction-3',
          schoolKey: 'imaginary',
          rawSchoolName: 'Imaginary Institute of Technology',
          schoolId: null,
          school: null,
          probability: 0.4,
          tierLabel: 'match',
          status: 'UNMATCHED',
          errorMsg: null,
        },
      ],
    });

    evaluator.evaluateSchool.mockImplementation(async (_profile, schoolId) => {
      if (schoolId === 'mit') {
        return {
          probability: 0.1,
          tier: 'reach',
          confidence: 'high',
          modelVersion: 'v5',
        };
      }
      return {
        probability: 0.45,
        tier: 'match',
        confidence: 'high',
        modelVersion: 'v5',
      };
    });

    const report = await service.buildReport('run-1');

    expect(report.summary.matchedCount).toBe(2);
    expect(report.summary.matchedProbabilityCount).toBe(1);
    expect(report.summary.tierOnlyCount).toBe(1);
    expect(report.summary.coverageGapCount).toBe(1);
    expect(report.summary.mae).toBeCloseTo(0.1, 6);
    expect(report.summary.tierAgreementRate).toBe(1);
    expect(report.rows[1]?.matchStatus).toBe('matched-tier-only');
  });

  it('resumes the most recent failed run instead of creating a new run', async () => {
    prisma.benchmarkProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      label: 'Profile',
      profileJson: { testScores: [], activities: [], awards: [] },
    });
    adapterRegistry.getSourceOrThrow.mockResolvedValue({
      id: 'source-1',
      key: 'mock',
      label: 'Mock Competitor',
      enabled: true,
    });
    adapterRegistry.getAdapterOrThrow.mockReturnValue({
      key: 'mock',
      baseUrl: 'https://mock-competitor.local',
      requiresSession: false,
    });
    prisma.competitorRun.findFirst.mockResolvedValue({
      id: 'run-1',
      profileId: 'profile-1',
      sourceId: 'source-1',
      startedAt: new Date('2026-04-22T00:00:00.000Z'),
      finishedAt: new Date('2026-04-22T00:05:00.000Z'),
      successCount: 2,
      errorCount: 1,
      note: 'Benchmark session appears expired',
      status: 'FAILED',
      profile: { label: 'Profile' },
      source: { key: 'mock', label: 'Mock Competitor' },
      _count: { predictions: 3 },
    });
    prisma.competitorRun.update.mockResolvedValue({
      id: 'run-1',
      profileId: 'profile-1',
      sourceId: 'source-1',
      startedAt: new Date('2026-04-22T00:00:00.000Z'),
      finishedAt: null,
      successCount: 2,
      errorCount: 1,
      note: 'headed=true',
      status: 'PENDING',
      profile: { label: 'Profile' },
      source: { key: 'mock', label: 'Mock Competitor' },
      _count: { predictions: 3 },
    });

    const run = await service.startRun({
      profileId: 'profile-1',
      sourceKey: 'mock',
      headed: true,
    });

    expect(prisma.competitorRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({
          status: 'PENDING',
          finishedAt: null,
        }),
      }),
    );
    expect(prisma.competitorRun.create).not.toHaveBeenCalled();
    expect(run.id).toBe('run-1');
    expect(run.status).toBe('PENDING');
  });

  it('counts a run-level session failure even when no row was persisted', async () => {
    prisma.competitorRun.findUnique.mockResolvedValue({
      id: 'run-2',
      profileId: 'profile-1',
      status: 'FAILED',
      note: 'Benchmark session appears expired for example.com. Please upload a fresh storageState.json.',
      profile: {
        id: 'profile-1',
        label: 'Test Profile',
        profileJson: { testScores: [], activities: [], awards: [] },
      },
      source: {
        key: 'sample',
        label: 'Sample Competitor',
      },
      predictions: [],
    });

    const report = await service.buildReport('run-2');

    expect(report.summary.sessionErrorCount).toBe(1);
    expect(report.summary.totalSchools).toBe(0);
  });
});
