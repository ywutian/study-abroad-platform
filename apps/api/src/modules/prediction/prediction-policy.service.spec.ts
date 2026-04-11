import { Test, TestingModule } from '@nestjs/testing';
import {
  PredictionPolicyService,
  LEGACY_PREDICTION_POLICY_VERSION,
} from './prediction-policy.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PredictionPolicyService', () => {
  let service: PredictionPolicyService;
  let prisma: { predictionPolicyVersion: { findFirst: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      predictionPolicyVersion: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionPolicyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PredictionPolicyService);
  });

  // ====================================================
  // resolveServedPolicyVersionId
  // ====================================================
  describe('resolveServedPolicyVersionId', () => {
    it('should return active policy ID when one exists', async () => {
      prisma.predictionPolicyVersion.findFirst.mockResolvedValue({
        id: 'policy-v4',
      });
      const result = await service.resolveServedPolicyVersionId();
      expect(result).toBe('policy-v4');
    });

    it('should return legacy version when no active policy', async () => {
      prisma.predictionPolicyVersion.findFirst.mockResolvedValue(null);
      const result = await service.resolveServedPolicyVersionId();
      expect(result).toBe(LEGACY_PREDICTION_POLICY_VERSION);
    });

    it('should query with correct ordering', async () => {
      await service.resolveServedPolicyVersionId();
      expect(prisma.predictionPolicyVersion.findFirst).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        orderBy: [{ activatedAt: 'desc' }, { updatedAt: 'desc' }],
        select: { id: true },
      });
    });
  });

  // ====================================================
  // resolveCohortKey
  // ====================================================
  describe('resolveCohortKey', () => {
    const makeProfile = (overrides: Record<string, unknown> = {}) =>
      ({
        nationality: null,
        educationSystem: null,
        currentSchoolType: null,
        highSchoolLocation: null,
        isInternational: false,
        ...overrides,
      }) as any;

    it('should return CN__OVERSEAS_HS for China + US high school', () => {
      const profile = makeProfile({
        nationality: 'CN',
        highSchoolLocation: 'US',
      });
      expect(service.resolveCohortKey(profile)).toBe('CN__OVERSEAS_HS');
    });

    it('should return CN__OVERSEAS_HS for China + US boarding school type', () => {
      const profile = makeProfile({
        nationality: 'CHN',
        currentSchoolType: 'BOARDING_US',
      });
      expect(service.resolveCohortKey(profile)).toBe('CN__OVERSEAS_HS');
    });

    it('should return CN__CHINA_INTL for China + IB system', () => {
      const profile = makeProfile({
        nationality: 'CN',
        educationSystem: 'IB',
      });
      expect(service.resolveCohortKey(profile)).toBe('CN__CHINA_INTL');
    });

    it('should return CN__CHINA_INTL for China + international school type', () => {
      const profile = makeProfile({
        nationality: 'CHINA',
        currentSchoolType: 'INTERNATIONAL',
      });
      expect(service.resolveCohortKey(profile)).toBe('CN__CHINA_INTL');
    });

    it('should return CN__CHINA_LOCAL for China without intl context', () => {
      const profile = makeProfile({ nationality: 'CN' });
      expect(service.resolveCohortKey(profile)).toBe('CN__CHINA_LOCAL');
    });

    it('should return US__US_HS for non-international applicant', () => {
      const profile = makeProfile({
        nationality: 'US',
        isInternational: false,
      });
      expect(service.resolveCohortKey(profile)).toBe('US__US_HS');
    });

    it('should return US__OVERSEAS_HS for intl + overseas school type', () => {
      const profile = makeProfile({
        nationality: 'KR',
        isInternational: true,
        currentSchoolType: 'US_HS',
      });
      expect(service.resolveCohortKey(profile)).toBe('US__OVERSEAS_HS');
    });

    it('should return OTHER_INTL as default', () => {
      const profile = makeProfile({
        nationality: 'KR',
        isInternational: true,
      });
      expect(service.resolveCohortKey(profile)).toBe('OTHER_INTL');
    });

    it('should handle null nationality', () => {
      const profile = makeProfile({ nationality: null });
      expect(service.resolveCohortKey(profile)).toBe('US__US_HS');
    });

    it('should be case-insensitive', () => {
      const profile = makeProfile({
        nationality: 'cn',
        educationSystem: 'a_level',
      });
      expect(service.resolveCohortKey(profile)).toBe('CN__CHINA_INTL');
    });
  });

  // ====================================================
  // buildTracePayload
  // ====================================================
  describe('buildTracePayload', () => {
    const makeParams = (overrides: Record<string, unknown> = {}) =>
      ({
        policyVersionId: 'policy-1',
        profile: {
          nationality: 'CN',
          highSchoolId: 'hs-1',
          highSchoolTier: 'TIER_1',
        },
        school: {},
        roundContext: 'ED',
        confidence: 'high' as const,
        schoolMeta: {
          acceptanceRate: 10,
          intlAcceptanceRate: 5,
          usNewsRank: 3,
          graduationRate: 95,
        },
        ...overrides,
      }) as any;

    it('should return complete trace with all metadata available', () => {
      const result = service.buildTracePayload(makeParams());
      expect(result.policyVersionId).toBe('policy-1');
      expect(result.cohortKey).toContain('CN__');
      expect(result.roundContext).toBe('ED');
      expect(result.priorTier).toBe('school_cohort_fallback');
      expect(result.uncertaintyReasons).toHaveLength(0);
      expect(result.sourceSummary).toHaveLength(2); // intl baseline + round adjustment
    });

    it('should fall back to overall rate when intl rate missing', () => {
      const result = service.buildTracePayload(
        makeParams({
          schoolMeta: { acceptanceRate: 10, usNewsRank: 3 },
        }),
      );
      expect(result.priorTier).toBe('school_overall_fallback');
      expect(result.uncertaintyReasons).toContain(
        'No cohort-specific admit rate was available for this school.',
      );
    });

    it('should use derived fallback when no rates available', () => {
      const result = service.buildTracePayload(
        makeParams({ schoolMeta: { usNewsRank: 3 } }),
      );
      expect(result.priorTier).toBe('derived_fallback');
      expect(result.uncertaintyReasons).toContain(
        'School baseline data is incomplete.',
      );
    });

    it('should add uncertainty for low confidence', () => {
      const result = service.buildTracePayload(
        makeParams({ confidence: 'low' }),
      );
      expect(result.uncertaintyReasons).toContain(
        'Profile data is incomplete, so this estimate has wider uncertainty.',
      );
    });

    it('should add uncertainty when school ranking missing', () => {
      const result = service.buildTracePayload(
        makeParams({
          schoolMeta: { acceptanceRate: 10, intlAcceptanceRate: 5 },
        }),
      );
      expect(result.uncertaintyReasons).toContain(
        'School metadata is partially missing.',
      );
    });

    it('should add uncertainty for missing high school context', () => {
      const result = service.buildTracePayload(
        makeParams({
          profile: {
            nationality: 'CN',
            highSchoolId: null,
            highSchoolTier: null,
          },
        }),
      );
      expect(result.uncertaintyReasons).toContain(
        'High school context is incomplete, so feeder and school-background signals were limited.',
      );
    });

    it('should default roundContext to RD and add uncertainty', () => {
      const result = service.buildTracePayload(
        makeParams({ roundContext: undefined }),
      );
      expect(result.roundContext).toBe('RD');
      expect(result.uncertaintyReasons).toContain(
        'Round-specific public data was limited; defaulted to regular decision context.',
      );
    });

    it('should uppercase roundContext', () => {
      const result = service.buildTracePayload(
        makeParams({ roundContext: 'ed' }),
      );
      expect(result.roundContext).toBe('ED');
    });
  });
});
