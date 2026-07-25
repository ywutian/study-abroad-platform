import { Injectable } from '@nestjs/common';
import { ProfileInput, SchoolInput } from './prediction.prompts';
import { COUNSELOR_RULE_VERSION } from './counselor/counselor-engine.service';

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
    totalLiveEffectiveWeight?: number;
    blendedPrePlatt: number;
    liveBlendedPrePlatt?: number;
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
  /**
   * The served policy-version label stamped on every prediction's
   * `servedPolicyVersionId`.
   *
   * The served path is counselor-only — the ML/v5 path was deleted 2026-05-07,
   * there is no champion/shadow model serving users. So the served policy
   * version IS the counselor engine's own rule version, NOT whatever row
   * happens to carry `status='ACTIVE'` in PredictionPolicyVersion.
   *
   * Coupling this label to the DB ACTIVE row is exactly what produced the
   * `v5-ml-primary` regression: a 2026-04-23 ML-era row was left ACTIVE after
   * the ML code was deleted, so counselor predictions got stamped with a dead
   * ML policy name. Returning the engine's own version makes the label
   * structurally incapable of drifting from the engine that produced it — the
   * guard test pins `servedPolicyVersionId === COUNSELOR_RULE_VERSION`, and an
   * engine bump (v1.8 → v1.9) carries the served label along automatically.
   *
   * The PredictionPolicyVersion table + its admin/shadow/workflow tooling are
   * retained as historical audit and scaffolding for any future policy-driven
   * serving experiments; they simply no longer drive this served label.
   */
  resolveServedPolicyVersionId(): string {
    return COUNSELOR_RULE_VERSION;
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
      oosAcceptanceRate?: number;
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

    // A missing `testingPolicy` is not cosmetic metadata: it decides whether a
    // no-score applicant takes a ×0.1 (REQUIRED) or ×1.0 (BLIND) hit. 96.3% of
    // prod schools have it UNKNOWN (audited 2026-07-24), so say so out loud
    // rather than letting the estimate look better-grounded than it is.
    const testingPolicyOnRecord =
      params.school.testingPolicy != null &&
      params.school.testingPolicy !== 'UNKNOWN';
    const hasStandardizedScore = (params.profile.testScores ?? []).some(
      (t) => (t.type === 'SAT' || t.type === 'ACT') && t.score,
    );
    if (!testingPolicyOnRecord && !hasStandardizedScore) {
      uncertaintyReasons.push(
        "This school's SAT/ACT requirement is not on record, so the effect of applying without scores could not be estimated precisely.",
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
