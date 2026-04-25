import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileInput, SchoolInput } from './prediction.prompts';
import { LEGACY_PREDICTION_POLICY_VERSION } from './prediction-policy.constants';

export { LEGACY_PREDICTION_POLICY_VERSION } from './prediction-policy.constants';
const CHINA_CODES = new Set(['CN', 'CHN', 'CHINA', 'PRC']);
const US_CODES = new Set(['US', 'USA', 'UNITED STATES']);
const CHINA_INTL_SYSTEMS = new Set([
  'A_LEVEL',
  'IB',
  'AP',
  'CANADIAN',
  'AUSTRALIAN',
]);
const CHINA_INTL_SCHOOL_TYPES = new Set(['INTERNATIONAL', 'INTL_CN']);
const OVERSEAS_SCHOOL_TYPES = new Set(['US_HS', 'BOARDING_US', 'INTL_OTHER']);

export interface PredictionTracePayload {
  policyVersionId: string;
  cohortKey: string;
  roundContext: string;
  priorTier: string;
  priorSourceId?: string;
  driftSignalIds: string[];
  relationshipSignalIds: string[];
  calibrationPath: string[];
  uncertaintyReasons: string[];
  sourceSummary: Array<{ label: string; detail?: string }>;
  distillation?: {
    stage: string | null;
    applyLiveBlend: boolean;
    liveEligible: boolean;
    coverageTier: string;
    cohortKey: string;
    activeTeacherKeys: string[];
    totalConfiguredWeight: number;
    totalEffectiveWeight: number;
    blendedPrePlatt: number;
    candidateServedProbability: number;
    servedProbability: number;
    teacherSummaries: Array<{
      key: string;
      active: boolean;
      probability: number | null;
      effectiveWeight: number;
      confidence: string;
      sampleCount: number | null;
      bucketKey: string | null;
      missingReasons: string[];
    }>;
  };
}

@Injectable()
export class PredictionPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveServedPolicyVersionId(): Promise<string> {
    const active = await this.prisma.predictionPolicyVersion.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: [{ activatedAt: 'desc' }, { updatedAt: 'desc' }],
      select: { id: true },
    });

    return active?.id ?? LEGACY_PREDICTION_POLICY_VERSION;
  }

  resolveCohortKey(profile: ProfileInput): string {
    const nationality = profile.nationality?.toUpperCase();
    const educationSystem = profile.educationSystem?.toUpperCase();
    const currentSchoolType = profile.currentSchoolType?.toUpperCase();
    const highSchoolLocation = profile.highSchoolLocation?.toUpperCase();

    const isChinaApplicant = nationality ? CHINA_CODES.has(nationality) : false;
    const isUsContext =
      (highSchoolLocation && US_CODES.has(highSchoolLocation)) ||
      (currentSchoolType && OVERSEAS_SCHOOL_TYPES.has(currentSchoolType));

    if (isChinaApplicant && isUsContext) return 'CN__OVERSEAS_HS';
    if (
      isChinaApplicant &&
      ((educationSystem && CHINA_INTL_SYSTEMS.has(educationSystem)) ||
        (currentSchoolType && CHINA_INTL_SCHOOL_TYPES.has(currentSchoolType)))
    ) {
      return 'CN__CHINA_INTL';
    }
    if (isChinaApplicant) return 'CN__CHINA_LOCAL';

    if (!profile.isInternational) return 'US__US_HS';
    if (currentSchoolType && OVERSEAS_SCHOOL_TYPES.has(currentSchoolType)) {
      return 'US__OVERSEAS_HS';
    }

    return 'OTHER_INTL';
  }

  buildTracePayload(params: {
    policyVersionId: string;
    profile: ProfileInput;
    school: SchoolInput;
    roundContext?: string;
    confidence: 'low' | 'medium' | 'high';
    schoolMeta?: {
      acceptanceRate?: number;
      intlAcceptanceRate?: number;
      usNewsRank?: number;
      graduationRate?: number;
    };
  }): PredictionTracePayload {
    const roundContext = params.roundContext?.toUpperCase() || 'RD';
    const cohortKey = this.resolveCohortKey(params.profile);
    const uncertaintyReasons: string[] = [];
    const sourceSummary: Array<{ label: string; detail?: string }> = [];

    const hasIntlRate = params.schoolMeta?.intlAcceptanceRate != null;
    const hasOverallRate = params.schoolMeta?.acceptanceRate != null;
    const hasSchoolRanking = params.schoolMeta?.usNewsRank != null;

    if (hasIntlRate && cohortKey.startsWith('CN__')) {
      sourceSummary.push({
        label: 'International admit baseline',
        detail: 'School-published international admit data',
      });
    } else if (hasOverallRate) {
      sourceSummary.push({
        label: 'School-wide admit baseline',
        detail: 'Fallback to school-wide published admit data',
      });
      uncertaintyReasons.push(
        'No cohort-specific admit rate was available for this school.',
      );
    } else {
      sourceSummary.push({
        label: 'Derived baseline',
        detail: 'Fallback to model-derived selectivity estimates',
      });
      uncertaintyReasons.push('School baseline data is incomplete.');
    }

    if (roundContext !== 'RD') {
      sourceSummary.push({
        label: 'Round-aware adjustment',
        detail: `${roundContext} context applied to the estimate`,
      });
    } else {
      uncertaintyReasons.push(
        'Round-specific public data was limited; defaulted to regular decision context.',
      );
    }

    if (!params.profile.highSchoolId && !params.profile.highSchoolTier) {
      uncertaintyReasons.push(
        'High school context is incomplete, so feeder and school-background signals were limited.',
      );
    }

    if (params.confidence === 'low') {
      uncertaintyReasons.push(
        'Profile data is incomplete, so this estimate has wider uncertainty.',
      );
    }

    if (!hasSchoolRanking) {
      uncertaintyReasons.push('School metadata is partially missing.');
    }

    return {
      policyVersionId: params.policyVersionId,
      cohortKey,
      roundContext,
      priorTier:
        hasIntlRate && cohortKey.startsWith('CN__')
          ? 'school_cohort_fallback'
          : hasOverallRate
            ? 'school_overall_fallback'
            : 'derived_fallback',
      driftSignalIds: [],
      relationshipSignalIds: [],
      calibrationPath: ['school_calibration', 'global_platt'],
      uncertaintyReasons,
      sourceSummary,
    };
  }
}
