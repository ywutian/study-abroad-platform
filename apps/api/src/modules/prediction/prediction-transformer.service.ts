import { Injectable } from '@nestjs/common';
import { School } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileInput, SchoolInput } from './prediction.prompts';
import {
  ProfileMetrics,
  SchoolMetrics,
  TIER_POINTS,
  LEVEL_POINTS,
} from './utils/score-calculator';
import { clampPercentRate } from '../../common/utils/percent.util';
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import {
  detectInternationalStatus,
  getBestEnglishProficiency,
} from '@study-abroad/shared/scoring';
import {
  TRUST_TIER_PREDICTION_WEIGHT,
  isPredictionEligibleTrustTier,
  normalizeFieldProvenance,
  resolveSchoolTestingPolicyValue,
  toLegacyTestOptionalFlag,
} from '@study-abroad/shared/utils';
import type { ProfileWithRelations } from './prediction.types';
import { classifyMajor } from './prediction.constants';

type ConfidenceLevel = 'low' | 'medium' | 'high';

const SCHOOL_CONFIDENCE_LOW_WEIGHT = 0.6;
const SCHOOL_CONFIDENCE_DOWNGRADE_WEIGHT = 0.85;
const TERMINAL_REAL_DATA_STATUSES = new Set([
  'MANUAL_REVIEW',
  'OFFICIAL_BLANK',
  'OFFICIAL_BLOCKED',
  'NO_PUBLIC_REAL_DATA',
]);

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value) return Number(value);
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return undefined;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

/**
 * Pure data transformation service for prediction engines.
 *
 * Converts Prisma entities to internal prediction DTOs and extracts
 * numeric metrics used by statistical, AI, and ML engines.
 */
@Injectable()
export class PredictionTransformerService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveTrustedSchoolField<T, R = T>(
    school: School,
    field: string,
    value: T | null | undefined,
    transform?: (value: T) => R | undefined,
  ): { value: R | undefined; weight?: number } {
    if (value == null) {
      return { value: undefined };
    }

    const provenance = normalizeFieldProvenance(
      toRecord(toRecord(school.metadata).provenance)[field],
    );
    if (!provenance) {
      // Absent provenance metadata is NOT a quality signal. The vast majority of
      // catalog schools carry no per-field provenance entry (the same gap the
      // `testingPolicy` exemption above documents) — on prod, 227/242 rated
      // schools have a real `acceptanceRate` with no `provenance.acceptanceRate`.
      // Nulling the value here silently dropped the counselor's PRIMARY anchor,
      // collapsing every non-CDS school to tier 4 ("数据不足"). The gate/local DB
      // never caught it because `seed.ts` seeds provenance that the prod
      // closure-overlay pipeline does not. Use the value (un-weighted); the
      // explicit heuristic/terminal/stale/low-tier checks below still reject data
      // whose provenance MARKS it untrustworthy.
      return { value: transform ? transform(value) : (value as unknown as R) };
    }

    const weight = TRUST_TIER_PREDICTION_WEIGHT[provenance.tier];
    const isHeuristic =
      provenance.tier === 'INFERRED' ||
      provenance.source.toUpperCase().includes('HEURISTIC');
    const isTerminal =
      provenance.realDataStatus != null &&
      TERMINAL_REAL_DATA_STATUSES.has(provenance.realDataStatus);
    if (
      isHeuristic ||
      isTerminal ||
      provenance.staleness === 'STALE' ||
      !isPredictionEligibleTrustTier(provenance.tier)
    ) {
      return { value: undefined, weight };
    }

    return {
      value: transform ? transform(value) : (value as unknown as R),
      weight,
    };
  }

  private getFeatureWeight(school: SchoolInput, fields: string[]): number {
    const weights = fields
      .map((field) => school.fieldTrustWeights?.[field])
      .filter((weight): weight is number => typeof weight === 'number');

    if (weights.length === 0) {
      return 1;
    }

    return weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
  }

  getAveragePredictionWeight(school: SchoolInput): number {
    if (typeof school.averagePredictionWeight === 'number') {
      return school.averagePredictionWeight;
    }

    const weights = Object.values(school.fieldTrustWeights ?? {}).filter(
      (weight): weight is number => typeof weight === 'number',
    );

    if (weights.length === 0) {
      return 1;
    }

    return weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
  }

  adjustConfidenceForSchoolTrust(
    confidence: ConfidenceLevel,
    school: SchoolInput,
  ): ConfidenceLevel {
    const averageWeight = this.getAveragePredictionWeight(school);

    if (averageWeight < SCHOOL_CONFIDENCE_LOW_WEIGHT) {
      return 'low';
    }

    if (averageWeight < SCHOOL_CONFIDENCE_DOWNGRADE_WEIGHT) {
      if (confidence === 'high') return 'medium';
      if (confidence === 'medium') return 'low';
    }

    return confidence;
  }

  private toFiniteNumber(value: unknown): number | undefined {
    const number = toNumber(value);
    return number != null && Number.isFinite(number) ? number : undefined;
  }

  private buildGpaTrend(
    profile: ProfileWithRelations,
  ): ProfileInput['gpaTrend'] {
    const semesterValues = (profile.semesterGpas ?? [])
      .map((sg, index) => ({
        label: sg.semester ?? `Semester ${index + 1}`,
        value: this.toFiniteNumber(sg.gpa),
        scale: this.toFiniteNumber(sg.gpaScale),
        order: typeof sg.order === 'number' ? sg.order : index,
        year: typeof sg.year === 'number' ? sg.year : undefined,
      }))
      .filter((entry) => entry.value != null)
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return (a.year ?? 0) - (b.year ?? 0);
      }) as Array<{
      label: string;
      value: number;
      scale?: number;
      order: number;
      year?: number;
    }>;

    if (semesterValues.length >= 2) {
      const first = semesterValues[0];
      const last = semesterValues[semesterValues.length - 1];
      const scale =
        last.scale ??
        first.scale ??
        this.toFiniteNumber(profile.gpaScale) ??
        4.0;
      const delta = ((last.value - first.value) / scale) * 4.0;
      const direction =
        delta >= 0.12 ? 'rising' : delta <= -0.12 ? 'falling' : 'flat';
      return {
        direction,
        delta,
        evidence: `${first.label} ${first.value.toFixed(2)} → ${last.label} ${last.value.toFixed(2)}`,
      };
    }

    const gradeValues = [
      { label: 'G9', value: this.toFiniteNumber(profile.gpa9) },
      { label: 'G10', value: this.toFiniteNumber(profile.gpa10) },
      { label: 'G11', value: this.toFiniteNumber(profile.gpa11) },
      { label: 'G12', value: this.toFiniteNumber(profile.gpa12) },
    ].filter((entry) => entry.value != null) as Array<{
      label: string;
      value: number;
    }>;

    if (gradeValues.length < 2) {
      return { direction: 'insufficient' };
    }

    const first = gradeValues[0];
    const last = gradeValues[gradeValues.length - 1];
    const scale = this.toFiniteNumber(profile.gpaScale) ?? 4.0;
    const delta = ((last.value - first.value) / scale) * 4.0;
    const direction =
      delta >= 0.12 ? 'rising' : delta <= -0.12 ? 'falling' : 'flat';
    return {
      direction,
      delta,
      evidence: `${first.label} ${first.value.toFixed(2)} → ${last.label} ${last.value.toFixed(2)}`,
    };
  }

  private resolveRuntimeGpa(profile: ProfileWithRelations): number | undefined {
    const direct = this.toFiniteNumber(profile.gpa);
    if (direct != null) return direct;

    const semesterValues = (profile.semesterGpas ?? [])
      .map((sg) => ({
        gpa: this.toFiniteNumber(sg.gpa),
        credits: this.toFiniteNumber(sg.credits),
      }))
      .filter((entry) => entry.gpa != null) as Array<{
      gpa: number;
      credits?: number;
    }>;
    if (semesterValues.length > 0) {
      const totalCredits = semesterValues.reduce(
        (sum, entry) =>
          sum + (entry.credits && entry.credits > 0 ? entry.credits : 0),
        0,
      );
      const average =
        totalCredits > 0
          ? semesterValues.reduce(
              (sum, entry) =>
                sum +
                entry.gpa *
                  (entry.credits && entry.credits > 0 ? entry.credits : 0),
              0,
            ) / totalCredits
          : semesterValues.reduce((sum, entry) => sum + entry.gpa, 0) /
            semesterValues.length;
      return Math.round(average * 100) / 100;
    }

    const gradeWeights: Record<string, number> = {
      g9: 0.2,
      g10: 0.25,
      g11: 0.3,
      g12: 0.25,
    };
    const gradeValues = [
      { key: 'g9', value: this.toFiniteNumber(profile.gpa9) },
      { key: 'g10', value: this.toFiniteNumber(profile.gpa10) },
      { key: 'g11', value: this.toFiniteNumber(profile.gpa11) },
      { key: 'g12', value: this.toFiniteNumber(profile.gpa12) },
    ].filter((entry) => entry.value != null) as Array<{
      key: string;
      value: number;
    }>;
    if (gradeValues.length === 0) return undefined;

    const totalWeight = gradeValues.reduce(
      (sum, entry) => sum + gradeWeights[entry.key],
      0,
    );
    const weighted = gradeValues.reduce(
      (sum, entry) => sum + entry.value * gradeWeights[entry.key],
      0,
    );
    return Math.round((weighted / totalWeight) * 100) / 100;
  }

  /**
   * Convert a Prisma profile (with relations) to the internal ProfileInput format
   * used by prediction engines and prompt builders.
   *
   * @param profile - Prisma profile with testScores, activities, and awards relations
   * @returns Normalized ProfileInput for prediction calculations
   */
  profileToInput(
    profile: ProfileWithRelations,
    assessmentData?: { mbtiType?: string; hollandCodes?: string[] },
  ): ProfileInput {
    // Extract the most recent high school education entry.
    // Sort by createdAt desc to pick the latest when multiple exist.
    const hsEducations = (profile.education || [])
      .filter((e) => e.schoolType === 'HIGH_SCHOOL')
      .sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      });
    const hsEducation = hsEducations[0];
    const hsRaw = hsEducation?.highSchool;
    // Quality gate: D-grade schools (hsImpactEnabled=false) are excluded from predictions
    const hs = hsRaw?.hsImpactEnabled === false ? undefined : hsRaw;
    const highSchoolName =
      hsEducation?.schoolName ?? profile.currentSchool ?? undefined;

    const intlContext = detectInternationalStatus({
      nationality: profile.nationality,
      countryOfResidence: profile.countryOfResidence,
      citizenship: profile.citizenship,
      educationSystem: profile.educationSystem,
      currentSchoolType: profile.currentSchoolType,
    });

    return {
      gpa: this.resolveRuntimeGpa(profile),
      gpaScale: profile.gpaScale ? Number(profile.gpaScale) : 4.0,
      gpaByGrade: {
        g9: this.toFiniteNumber(profile.gpa9),
        g10: this.toFiniteNumber(profile.gpa10),
        g11: this.toFiniteNumber(profile.gpa11),
        g12: this.toFiniteNumber(profile.gpa12),
      },
      semesterGpas: (profile.semesterGpas ?? []).map((sg) => ({
        semester: sg.semester,
        year: sg.year,
        gpa: Number(sg.gpa),
        gpaScale: sg.gpaScale != null ? Number(sg.gpaScale) : undefined,
        credits: sg.credits != null ? Number(sg.credits) : undefined,
        order: sg.order,
      })),
      gpaTrend: this.buildGpaTrend(profile),
      // `?? undefined` like every sibling line: the column is nullable and
      // `ProfileInput.gpaSystem` is `string | undefined`. The mismatch was
      // invisible while `education` was read through an untyped cast. No consumer
      // misbehaves today — they all test truthiness — but the type said one
      // thing and the value was another.
      gpaSystem: hsEducation?.gpaSystem ?? undefined,
      grade: profile.grade ?? undefined,
      currentSchoolType: profile.currentSchoolType ?? undefined,
      targetMajor: profile.targetMajor ?? profile.intendedMajor ?? undefined,
      isInternational: intlContext.isInternational,
      nationality: profile.nationality ?? undefined,
      educationSystem: profile.educationSystem ?? undefined,
      needsFinancialAid: profile.needsFinancialAid ?? undefined,
      highSchoolId: hs?.id ?? undefined,
      highSchoolName,
      highSchoolTier: hs?.tier ?? undefined,
      highSchoolType: hs?.type ?? profile.currentSchoolType ?? undefined,
      highSchoolLocation: hs?.state || hs?.country || undefined,
      highSchoolRecognition: hs?.recognition ?? undefined,
      highSchoolAcademicRigor: hs?.academicRigor ?? undefined,
      highSchoolPlacementRecord: hs?.placementRecord ?? undefined,
      highSchoolStudentQuality: hs?.studentQuality ?? undefined,
      highSchoolResources: hs?.resources ?? undefined,
      highSchoolGradeInflation: hs?.gradeInflation ?? undefined,
      highSchoolImpactEnabled: hsRaw?.hsImpactEnabled ?? undefined,
      testScores: (profile.testScores || []).map((s) => ({
        type: s.type,
        score: s.score,
        subScores: s.subScores as Record<string, number> | undefined,
      })),
      activities: (profile.activities || []).map((a) => ({
        name: a.name,
        category: a.category,
        role: a.role,
        description: a.description ?? undefined,
        hoursPerWeek: a.hoursPerWeek ?? undefined,
        weeksPerYear: a.weeksPerYear ?? undefined,
        annualHours:
          a.hoursPerWeek != null && a.weeksPerYear != null
            ? a.hoursPerWeek * a.weeksPerYear
            : undefined,
        yearsActive:
          a.gradeLevels?.length ??
          (a.startDate && a.endDate
            ? Math.max(
                1,
                new Date(a.endDate).getFullYear() -
                  new Date(a.startDate).getFullYear() +
                  1,
              )
            : undefined),
        tier: a.activityTemplate?.tier ?? undefined,
        gradeLevels: a.gradeLevels ?? undefined,
        timing: a.timing ?? undefined,
      })),
      awards: (profile.awards || []).map((a) => ({
        level: a.level,
        name: a.name,
        tier: a.competition?.tier ?? undefined,
        competitionName: a.competition?.name ?? undefined,
        category: a.category ?? a.competition?.category ?? undefined,
        year: a.year ?? undefined,
      })),
      englishProficiency: getBestEnglishProficiency(profile.testScores || []),
      assessment: assessmentData,
      isLegacy: profile.legacy?.length > 0,
      legacySchools: profile.legacy?.length > 0 ? profile.legacy : undefined,
      isFirstGen: profile.firstGeneration ?? false,
      recruitedAthlete: profile.recruitedAthlete ?? false,
      // closure-v2: explicit US state of residence (independent of HS location).
      // geoMultiplier prefers this over highSchoolLocation; without this line
      // the geoMultiplier branch that reads it is unreachable dead code.
      stateOfResidence: profile.stateOfResidence ?? undefined,
      urmStatus: profile.urmStatus ?? null,
      // PR-14: explicit "applying test-optional" flag triggers 0.85× modifier
      // at <20% admit schools per Common App data.
      applyingTestOptional: profile.applyingTestOptional ?? false,
    };
  }

  /**
   * Convert a Prisma School entity to the internal SchoolInput format.
   *
   * @param school - Prisma School entity
   * @returns Normalized SchoolInput for prediction calculations
   */
  schoolToInput(school: School): SchoolInput {
    const fieldTrustWeights: Record<string, number> = {};
    const captureField = <T, R = T>(
      field: string,
      value: T | null | undefined,
      transform?: (raw: T) => R | undefined,
    ): R | undefined => {
      const resolved = this.resolveTrustedSchoolField(
        school,
        field,
        value,
        transform,
      );
      if (resolved.value !== undefined && typeof resolved.weight === 'number') {
        fieldTrustWeights[field] = resolved.weight;
      }
      return resolved.value;
    };

    // testingPolicy + testOptional are structural classification fields used
    // to route admission policy display ('BLIND'/'OPTIONAL'/'REQUIRED') and
    // by CounselorEngine modifiers. They must NOT go through the trust-tier
    // filter — most schools lack explicit metadata.provenance entries for
    // these fields, which would otherwise downgrade them to UNKNOWN and
    // break the application-analysis golden render fixtures (E2E
    // application-analysis-render expects 'BLIND' for Berkeley etc.).
    const rawTestingPolicy = school.testingPolicy ?? undefined;
    const rawTestOptional = school.testOptional ?? undefined;
    const testingPolicy =
      rawTestingPolicy ??
      resolveSchoolTestingPolicyValue({
        testingPolicy: rawTestingPolicy,
        testOptional: rawTestOptional,
      });

    return {
      id: school.id,
      name: school.name,
      nameZh: school.nameZh ?? undefined,
      country: school.country ?? undefined,
      state: school.state ?? undefined,
      isPrivate: school.isPrivate ?? undefined,
      acceptanceRate: captureField(
        'acceptanceRate',
        school.acceptanceRate,
        (value) => clampPercentRate(toNumber(value)),
      ),
      intlAcceptanceRate: captureField(
        'intlAcceptanceRate',
        school.intlAcceptanceRate,
        (value) => clampPercentRate(toNumber(value)),
      ),
      oosAcceptanceRate: captureField(
        'oosAcceptanceRate',
        school.oosAcceptanceRate,
        (value) => clampPercentRate(toNumber(value)),
      ),
      // Dead-wire fix (#349 follow-up): the counselor geoMultiplier in-state branch
      // reads SchoolInput.inStateAcceptanceRate, but it was only mapped into
      // extractSchoolMetrics() — so the data-grounded in-state path was unreachable
      // and every in-state prediction fell back to the flagship-ratio proxy.
      inStateAcceptanceRate: captureField(
        'inStateAcceptanceRate',
        school.inStateAcceptanceRate,
        (value) => clampPercentRate(toNumber(value)),
      ),
      transferAcceptanceRate: captureField(
        'transferAcceptanceRate',
        school.transferAcceptanceRate,
        (value) => clampPercentRate(toNumber(value)),
      ),
      intlStudentPct: captureField(
        'intlStudentPct',
        school.intlStudentPct,
        (value) => Number(value),
      ),
      needBlindInternational: captureField(
        'needBlindInternational',
        school.needBlindInternational,
      ),
      satAvg: captureField('satAvg', school.satAvg),
      sat25: captureField('sat25', school.sat25),
      sat75: captureField('sat75', school.sat75),
      actAvg: captureField('actAvg', school.actAvg),
      act25: captureField('act25', school.act25),
      act75: captureField('act75', school.act75),
      usNewsRank: captureField('usNewsRank', school.usNewsRank),
      graduationRate: captureField(
        'graduationRate',
        school.graduationRate,
        (value) => clampPercentRate(toNumber(value)),
      ),
      retentionRate: captureField(
        'retentionRate',
        school.retentionRate,
        (value) => clampPercentRate(toNumber(value)),
      ),
      studentFacultyRatio: captureField(
        'studentFacultyRatio',
        school.studentFacultyRatio,
      ),
      percentNeedMet: captureField(
        'percentNeedMet',
        school.percentNeedMet,
        (value) => clampPercentRate(toNumber(value)),
      ),
      averageNetPrice: captureField('averageNetPrice', school.averageNetPrice),
      testingPolicy,
      testOptional: toLegacyTestOptionalFlag({
        testingPolicy,
        testOptional: rawTestOptional,
      }),
      hasEarlyDecision: captureField(
        'hasEarlyDecision',
        school.hasEarlyDecision,
      ),
      hasEarlyDecision2: captureField(
        'hasEarlyDecision2',
        school.hasEarlyDecision2,
      ),
      hasEarlyAction: captureField('hasEarlyAction', school.hasEarlyAction),
      hasRestrictiveEa: captureField(
        'hasRestrictiveEa',
        school.hasRestrictiveEa,
      ),
      edAcceptanceRate: captureField(
        'edAcceptanceRate',
        school.edAcceptanceRate,
        (value) => clampPercentRate(toNumber(value)),
      ),
      ed2AcceptanceRate: captureField(
        'ed2AcceptanceRate',
        school.ed2AcceptanceRate,
        (value) => clampPercentRate(toNumber(value)),
      ),
      eaAcceptanceRate: captureField(
        'eaAcceptanceRate',
        school.eaAcceptanceRate,
        (value) => clampPercentRate(toNumber(value)),
      ),
      // closure-v2: CDS C2 yield — feeds roundMultiplier's yield-informed ED
      // estimate. Without this line the SchoolInput.yieldRate field and the
      // engine branch that reads it are unreachable dead code.
      yieldRate: captureField('yieldRate', school.yieldRate, (value) =>
        clampPercentRate(toNumber(value)),
      ),
      // institutionType is a structural classification (ART_DESIGN /
      // MUSIC_CONSERVATORY / etc.) used by CounselorEngine.isAuditionOrPortfolioSchool
      // to route to tier 4 (unavailable). It must NOT be filtered by trust-tier
      // provenance because (a) it's categorical, not a stat to weight, and
      // (b) most schools lack explicit metadata.provenance.institutionType
      // entries. Pass the raw value through. Caught by
      // verify-prediction-launch's tier4 fixture when this was wrong.
      institutionType: school.institutionType ?? undefined,
      gpaDistribution: captureField('gpaDistribution', school.gpaDistribution),
      fieldTrustWeights,
      averagePredictionWeight:
        Object.keys(fieldTrustWeights).length > 0
          ? Object.values(fieldTrustWeights).reduce(
              (sum, weight) => sum + weight,
              0,
            ) / Object.values(fieldTrustWeights).length
          : 1,
    };
  }

  /**
   * Extract numeric metrics from a ProfileInput for use in statistical calculations.
   *
   * Pulls SAT, ACT, TOEFL scores from testScores array and counts activities/awards
   * by level (national, international).
   *
   * @param profile - The normalized profile input
   * @returns ProfileMetrics with scores, counts, and award breakdowns
   */
  extractProfileMetrics(profile: ProfileInput): ProfileMetrics {
    const satScore = profile.testScores.find((s) => s.type === 'SAT')?.score;
    const actScore = profile.testScores.find((s) => s.type === 'ACT')?.score;
    const toeflScore = profile.testScores.find(
      (s) => s.type === 'TOEFL',
    )?.score;

    // Unified English proficiency: pick the best of TOEFL/IELTS/Duolingo
    const bestEnglish = getBestEnglishProficiency(profile.testScores);
    const englishProficiencyScore = bestEnglish?.normalized;

    const awardTierScores = profile.awards.map((a) => {
      if (a.tier)
        return TIER_POINTS[a.tier] ?? LEVEL_POINTS[a.level ?? ''] ?? 3;
      return LEVEL_POINTS[a.level ?? ''] ?? 3;
    });

    return {
      gpa: profile.gpa,
      gpaScale: profile.gpaScale,
      gpaSystem: profile.gpaSystem,
      satScore,
      actScore,
      toeflScore,
      englishProficiencyScore,
      activityCount: profile.activities.length,
      activityDetails: profile.activities.map((a) => ({
        category: a.category || '',
        role: a.role || '',
        totalHours: (a.hoursPerWeek ?? 0) * (a.weeksPerYear ?? 0),
        // `a` is a `ProfileInput` activity, not a Prisma row: `profileToInput`
        // above already flattens `activityTemplate.tier` into `tier`. Reading
        // `activityTemplate` here through an untyped cast therefore always produced
        // `undefined`, and the cast is the only reason that typechecked.
        // Inert today — the served counselor path builds its own
        // activityDetails (counselor-modifiers.ts, `tier: activity.tier`) and
        // this object's consumers read `activityCount`, never `tier`.
        tier: a.tier,
      })),
      awardCount: profile.awards.length,
      nationalAwardCount: profile.awards.filter((a) => a.level === 'NATIONAL')
        .length,
      internationalAwardCount: profile.awards.filter(
        (a) => a.level === 'INTERNATIONAL',
      ).length,
      awardTierScores,
      highSchoolTier: profile.highSchoolTier,
      highSchoolType: profile.highSchoolType,
      highSchoolRecognition: profile.highSchoolRecognition,
      highSchoolAcademicRigor: profile.highSchoolAcademicRigor,
      highSchoolPlacementRecord: profile.highSchoolPlacementRecord,
      highSchoolStudentQuality: profile.highSchoolStudentQuality,
      highSchoolResources: profile.highSchoolResources,
      highSchoolGradeInflation: profile.highSchoolGradeInflation,
      targetMajorCategory: profile.targetMajor
        ? classifyMajor(profile.targetMajor)
        : undefined,
      isLegacy: profile.isLegacy,
      isFirstGen: profile.isFirstGen,
      needsFinancialAid: profile.needsFinancialAid,
      essayQualityScore: profile.essayQualityScore,
      isInternational: profile.isInternational,
      educationSystem: profile.educationSystem,
    };
  }

  /**
   * Extract numeric metrics from a SchoolInput for use in statistical calculations.
   *
   * @param school - The normalized school input
   * @returns SchoolMetrics including acceptance rate, test score ranges, and ranking
   */
  extractSchoolMetrics(school: SchoolInput): SchoolMetrics {
    return {
      acceptanceRate: school.acceptanceRate,
      satAvg: school.satAvg,
      sat25: school.sat25,
      sat75: school.sat75,
      actAvg: school.actAvg,
      act25: school.act25,
      act75: school.act75,
      usNewsRank: school.usNewsRank,
      graduationRate: school.graduationRate,
      testingPolicy: school.testingPolicy,
      edAcceptanceRate: school.edAcceptanceRate ?? undefined,
      ed2AcceptanceRate: school.ed2AcceptanceRate ?? undefined,
      eaAcceptanceRate: school.eaAcceptanceRate ?? undefined,
      intlAcceptanceRate: school.intlAcceptanceRate,
      oosAcceptanceRate: school.oosAcceptanceRate,
      inStateAcceptanceRate: school.inStateAcceptanceRate,
      transferAcceptanceRate: school.transferAcceptanceRate,
      hasEarlyDecision: school.hasEarlyDecision,
      institutionType: school.institutionType,
      gpaDistribution: school.gpaDistribution,
    };
  }

  /**
   * Evaluate how complete the available profile and school data is on a 0-100 scale.
   *
   * Profile data contributes up to 68 points: GPA (15), GPA system (3),
   * SAT/ACT (15), TOEFL (5), activities (10), awards (10), target major (5),
   * high school background (5). School data contributes up to 40 points:
   * acceptance rate (10), ranking (10), SAT range (10), ACT range (10).
   *
   * Raw score is normalized to 0-100 from a max of 108.
   *
   * @param profile - Normalized profile input
   * @param school - Normalized school input
   * @returns Completeness score from 0 to 100
   */
  evaluateDataCompleteness(profile: ProfileInput, school: SchoolInput): number {
    let score = 0;
    const maxScore = 108;

    // Profile 数据 (68 分)
    if (profile.gpa) score += 15;
    if (profile.gpaSystem) score += 3;
    if (profile.testScores.some((s) => s.type === 'SAT' || s.type === 'ACT'))
      score += 15;
    if (
      profile.testScores.some(
        (s) =>
          s.type === 'TOEFL' || s.type === 'IELTS' || s.type === 'DUOLINGO',
      )
    )
      score += 5;
    if (profile.activities.length > 0) score += 10;
    if (profile.awards.length > 0) score += 10;
    if (profile.targetMajor) score += 5;
    if (profile.highSchoolTier || profile.highSchoolName) score += 5;

    // School 数据 (40 分)
    if (school.acceptanceRate != null) {
      score += 10 * this.getFeatureWeight(school, ['acceptanceRate']);
    }
    if (school.graduationRate != null) {
      score += 10 * this.getFeatureWeight(school, ['graduationRate']);
    }
    if (
      school.satAvg != null ||
      (school.sat25 != null && school.sat75 != null)
    ) {
      score +=
        10 *
        this.getFeatureWeight(
          school,
          school.satAvg != null ? ['satAvg'] : ['sat25', 'sat75'],
        );
    }
    if (
      school.actAvg != null ||
      (school.act25 != null && school.act75 != null)
    ) {
      score +=
        10 *
        this.getFeatureWeight(
          school,
          school.actAvg != null ? ['actAvg'] : ['act25', 'act75'],
        );
    }

    return Math.min(100, Math.round((score / maxScore) * 100));
  }

  /**
   * Enrich a ProfileInput with the latest essay AI review quality score.
   *
   * Queries the most recent EssayAIResult (type = 'review') for the given profile
   * and extracts the overallScore from the stored JSON scores field.
   *
   * @param profileInput - The profile input to enrich (mutated in place)
   * @param profileId - The Prisma profile ID used to find linked essays
   * @returns The enriched ProfileInput (same reference)
   */
  async enrichWithEssayQuality(
    profileInput: ProfileInput,
    profileId: string,
  ): Promise<ProfileInput> {
    try {
      // governance: parent-scoped — reads the EssayAIResult belonging to the analysis being transformed
      const latestReview = await this.prisma.essayAIResult.findFirst({
        where: {
          essay: { profileId },
          type: 'review',
        },
        orderBy: { createdAt: 'desc' },
        select: { output: true, scores: true },
      });

      if (latestReview?.output || latestReview?.scores) {
        // The output is the raw LLM response — use extractJsonFromLlm for robust parsing
        const parsed = extractJsonFromLlm<{ overallScore?: number }>(
          latestReview.output ?? '',
        );
        const score =
          parsed && typeof parsed.overallScore === 'number'
            ? parsed.overallScore
            : // `scores` is a Json column, so it needs a narrowing rather than
              // a field access. `toRecord` is this file's own helper for
              // exactly that and returns `{}` for null/array/scalar.
              typeof toRecord(latestReview.scores).overallScore === 'number'
              ? (toRecord(latestReview.scores).overallScore as number)
              : undefined;
        if (typeof score === 'number' && Number.isFinite(score)) {
          profileInput.essayQualityScore =
            score > 10 ? Math.round((score / 10) * 10) / 10 : score;
        }
      }
    } catch {
      // Non-critical — essay quality is an optional enrichment
    }

    return profileInput;
  }
}
