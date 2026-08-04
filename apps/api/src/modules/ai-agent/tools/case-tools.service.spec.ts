import { Test, TestingModule } from '@nestjs/testing';
import { CaseToolsService } from './case-tools.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LLMService } from '../core/llm.service';
import { SwipeService } from '../../hall/swipe.service';
import { ProfileLoaderHelper } from './helpers/profile-loader.helper';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';
import {
  RequestContextMiddleware,
  UserContextMiddleware,
} from '../infrastructure/context/request-context';

describe('CaseToolsService', () => {
  let service: CaseToolsService;
  let prisma: {
    admissionCase: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseToolsService,
        {
          provide: PrismaService,
          useValue: {
            admissionCase: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn(),
              findFirst: jest.fn().mockResolvedValue(null),
            },
            predictionResult: { findMany: jest.fn().mockResolvedValue([]) },
          },
        },
        {
          provide: LLMService,
          useValue: {
            chatSimple: jest.fn().mockResolvedValue('{"analysis":"ok"}'),
          },
        },
        {
          provide: SwipeService,
          useValue: { getSwipeStats: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: ProfileLoaderHelper,
          useValue: {
            getProfileId: jest.fn().mockResolvedValue('profile-1'),
            loadProfile: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: SchoolLookupHelper,
          useValue: { findSchool: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(CaseToolsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register tool handlers', () => {
    const handlers = service.getHandlers();
    expect(handlers.has('search_cases')).toBe(true);
    expect(handlers.has('explain_case_result')).toBe(true);
    expect(handlers.has('analyze_prediction_accuracy')).toBe(true);
  });

  it('should return empty results when no cases found', async () => {
    prisma.admissionCase.findMany.mockResolvedValue([]);
    const result = await service.searchCases({ schoolName: 'Stanford' }, 'en');
    expect(result).toBeDefined();
  });

  describe("VERIFIED_ONLY follows the caller's role", () => {
    // The tool layer must grant what GET /cases/:id grants the same caller —
    // no more (that is the escalation #531 fixed) and no less (that is the
    // feature a VERIFIED user paid for). The role comes from the request
    // context, so these drive it through the real accessor.
    const runAs = async (role: string | undefined, fn: () => Promise<void>) => {
      const scope = new RequestContextMiddleware();
      const userCtx = new UserContextMiddleware();
      const req = (u?: unknown) =>
        ({
          path: '/ai-agent/chat',
          method: 'POST',
          headers: {},
          socket: {},
          user: u,
        }) as any;
      const res = {
        setHeader: jest.fn(),
        on: jest.fn(),
        statusCode: 200,
      } as any;

      await new Promise<void>((resolve, reject) => {
        scope.use(req(), res, () => {
          userCtx.use(req(role ? { sub: 'u-1', role } : undefined), res, () => {
            fn().then(resolve, reject);
          });
        });
      });
    };

    const visibilityOf = () =>
      prisma.admissionCase.findFirst.mock.calls[0][0].where.visibility.in;

    it('includes VERIFIED_ONLY for a VERIFIED caller', async () => {
      prisma.admissionCase.findFirst.mockResolvedValue(null);

      await runAs('VERIFIED', async () => {
        await service.explainCaseResult('case-1', 'en');
      });

      // PUBLIC retired for cases 2026-08-04 — assert the exact set, not a
      // superset: `arrayContaining` would have passed just as happily if a
      // retired or unintended value were added back alongside these two.
      expect(visibilityOf()).toEqual(['ANONYMOUS', 'VERIFIED_ONLY']);
    });

    it('excludes it for a plain USER', async () => {
      prisma.admissionCase.findFirst.mockResolvedValue(null);

      await runAs('USER', async () => {
        await service.explainCaseResult('case-1', 'en');
      });

      expect(visibilityOf()).not.toContain('VERIFIED_ONLY');
    });

    it('excludes it when there is no request context at all', async () => {
      // Background/queue execution, or a route the middleware does not cover.
      // Absent role must read as "no role", never as trusted.
      prisma.admissionCase.findFirst.mockResolvedValue(null);

      await service.explainCaseResult('case-1', 'en');

      expect(visibilityOf()).not.toContain('VERIFIED_ONLY');
    });

    it('never widens past VERIFIED_ONLY — PRIVATE stays out for everyone', async () => {
      prisma.admissionCase.findFirst.mockResolvedValue(null);

      await runAs('SUPER_ADMIN', async () => {
        await service.explainCaseResult('case-1', 'en');
      });

      expect(visibilityOf()).not.toContain('PRIVATE');
    });
  });

  describe('analyzeIntlCompetitiveness — small-cohort suppression', () => {
    const admitted = (n: number) =>
      Array.from({ length: n }, () => ({ result: 'ADMITTED' }));
    const rejected = (n: number) =>
      Array.from({ length: n }, () => ({ result: 'REJECTED' }));

    it('withholds outcomes for a cohort under the floor', async () => {
      // One Chinese applicant at this school. "1 case, 100% admitted" states
      // where that identifiable person got in — the count may go out, the
      // outcome may not.
      prisma.admissionCase.findMany
        .mockResolvedValueOnce(admitted(1)) // nationality slice
        .mockResolvedValueOnce([...admitted(15), ...rejected(5)]); // all international

      const r: any = await service.analyzeIntlCompetitiveness(
        { schoolId: 's-1', nationality: 'China' },
        'en',
      );

      expect(r.nationality.insufficientData).toBe(true);
      expect(r.nationality.totalCases).toBe(1);
      expect(r.nationality).not.toHaveProperty('admitted');
      expect(r.nationality).not.toHaveProperty('admitRate');

      // The prose is fed to the LLM, so it must not restate what the fields
      // withhold. Assert on the nationality segment only — the other slice
      // clears the floor and is allowed to carry a rate.
      const [natSegment] = r.summary.split(';');
      expect(natSegment).toContain('withheld');
      expect(natSegment).not.toMatch(/%/);

      // the slice that clears the floor still reports normally
      expect(r.allInternational.admitRate).toBe('75.0%');
    });

    it('reports outcomes once the cohort reaches the floor', async () => {
      prisma.admissionCase.findMany
        .mockResolvedValueOnce([...admitted(4), { result: 'REJECTED' }]) // exactly 5
        .mockResolvedValueOnce(admitted(20));

      const r: any = await service.analyzeIntlCompetitiveness(
        { schoolId: 's-1', nationality: 'China' },
        'en',
      );

      expect(r.nationality).not.toHaveProperty('insufficientData');
      expect(r.nationality.totalCases).toBe(5);
      expect(r.nationality.admitted).toBe(4);
      expect(r.nationality.admitRate).toBe('80.0%');
    });
  });
});
