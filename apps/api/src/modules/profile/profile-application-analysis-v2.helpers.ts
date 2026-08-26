import { Prisma, SchoolPolicyDimension, SchoolTier } from '@prisma/client';
import type { SchoolTestingPolicy } from '@study-abroad/shared';
import {
  getSchoolDisplayName,
  resolveSchoolTestingPolicyValue,
} from '@study-abroad/shared/utils';
import { formatHighSchoolContext } from '../ai-agent/tools/helpers/education-context.helper';
import type {
  AnalysisActionPlan,
  AnalysisApplicantType,
  AnalysisContextFlag,
  AnalysisDataQuality,
  AnalysisState,
  ApplicationAnalysisConfidenceSummary,
  ApplicationAnalysisEvidenceSummaryItem,
  ApplicationAnalysisFreshnessSummary,
  ApplicationAnalysisPolicyCard,
  ApplicationAnalysisPortfolioSummary,
  ApplicationAnalysisProfileSummary,
  ApplicationAnalysisSchoolResult,
  ApplicationAnalysisSourceRef,
  ApplicationAnalysisStatus,
  PortfolioBalance,
  SchoolIntlAidPolicy,
  SchoolRoundContext,
} from '../ai/ai.types';
import { resolveEffectiveTier } from '../school-list/school-list.constants';

export const MAX_FOCUS_SCHOOLS = 5;

export const ANALYSIS_SCHOOL_SELECT = {
  id: true,
  name: true,
  nameZh: true,
  usNewsRank: true,
  acceptanceRate: true,
  sat25: true,
  sat75: true,
  satAvg: true,
  testingPolicy: true,
  testOptional: true,
  needBlindInternational: true,
  intlAcceptanceRate: true,
  metadata: true,
} satisfies Prisma.SchoolSelect;

export type LoadedProfile = Prisma.ProfileGetPayload<{
  include: {
    testScores: { orderBy: { createdAt: 'desc' } };
    activities: {
      orderBy: { order: 'asc' };
      include: { activityTemplate: true };
    };
    awards: {
      orderBy: { order: 'asc' };
      include: { competition: true };
    };
    education: { include: { highSchool: true } };
    essays: true;
    semesterGpas: { orderBy: { order: 'asc' } };
  };
}>;

export type LoadedSchoolListItem = Prisma.SchoolListItemGetPayload<{
  include: {
    school: { select: typeof ANALYSIS_SCHOOL_SELECT };
  };
}>;

export type LoadedPrediction = Prisma.PredictionResultGetPayload<{
  select: {
    id: true;
    schoolId: true;
    probability: true;
    probabilityLow: true;
    probabilityHigh: true;
    tier: true;
    confidence: true;
    factors: true;
    suggestions: true;
    confidenceReason: true;
    applicationRound: true;
    updatedAt: true;
  };
}>;

export type ApprovedPolicyEvidence = Prisma.SchoolPolicyEvidenceGetPayload<{
  select: {
    id: true;
    schoolId: true;
    policyDimension: true;
    policyValue: true;
    sourceName: true;
    sourceUrl: true;
    sourcePublishedAt: true;
    updatedAt: true;
    metadata: true;
  };
}>;

export type SchoolEvidenceByDimension = Partial<
  Record<SchoolPolicyDimension, ApprovedPolicyEvidence>
>;
export type SchoolEvidenceMap = Map<string, SchoolEvidenceByDimension>;

export interface PolicyCardBuildResult {
  card: ApplicationAnalysisPolicyCard;
  unknowns: string[];
}

// NOTE (scoped-out): this sorts on the stored `item.tier`, which for PREDICTED
// rows is the stale placeholder — the same bug the portfolio balance just
// fixed. It is NOT fixed here on purpose: focus selection runs *before*
// predictions are loaded (predictions are fetched for the schools this picks),
// so the effective tier isn't available yet without reordering the pipeline.
// Tracked as a follow-up; the round-presence sort still dominates so the
// practical impact is limited to tie-breaking order.
export function selectFocusSchools(
  items: LoadedSchoolListItem[],
): LoadedSchoolListItem[] {
  return [...items]
    .sort((a, b) => {
      const roundRank = Number(Boolean(b.round)) - Number(Boolean(a.round));
      if (roundRank !== 0) return roundRank;

      const tierRank =
        resolveSchoolListTierRank(a.tier) - resolveSchoolListTierRank(b.tier);
      if (tierRank !== 0) return tierRank;

      return b.updatedAt.getTime() - a.updatedAt.getTime();
    })
    .slice(0, MAX_FOCUS_SCHOOLS);
}

export function resolveDataQuality(
  profile: LoadedProfile,
  targetSchoolCount: number,
): AnalysisDataQuality {
  let score = 0;
  if (resolvePrimaryGpa(profile) != null) score += 25;
  if (profile.testScores.length > 0) score += 15;
  if (profile.activities.length > 0) score += 20;
  if (profile.awards.length > 0) score += 15;
  if (profile.targetMajor || profile.intendedMajor) score += 10;
  if (profile.education.length > 0) score += 10;
  if (targetSchoolCount > 0) score += 5;

  if (score >= 80) return 'high';
  if (score >= 55) return 'medium';
  if (score >= 35) return 'low';
  return 'insufficient';
}

export function hasMinimumProfileEvidence(profile: LoadedProfile): boolean {
  return Boolean(
    resolvePrimaryGpa(profile) != null ||
    profile.testScores.length > 0 ||
    profile.activities.length > 0 ||
    profile.awards.length > 0,
  );
}

export function resolveAnalysisState(
  profile: LoadedProfile | null,
  schoolListItems: LoadedSchoolListItem[],
  focusSchools: LoadedSchoolListItem[],
  predictions: LoadedPrediction[],
  dataQuality: AnalysisDataQuality,
): AnalysisState {
  if (
    !profile ||
    !hasMinimumProfileEvidence(profile) ||
    dataQuality === 'insufficient'
  ) {
    return 'insufficientProfileData';
  }
  if (schoolListItems.length === 0) return 'noTargetSchools';
  if (focusSchools.length > 0 && predictions.length === 0)
    return 'noPredictions';
  return 'ready';
}

export function buildProfileSummary(
  profile: LoadedProfile,
  locale: string,
): ApplicationAnalysisProfileSummary {
  const isInternational = Boolean(
    profile.citizenship &&
    profile.countryOfResidence &&
    profile.citizenship !== 'US' &&
    profile.countryOfResidence !== 'US',
  );

  const contextFlags: AnalysisContextFlag[] = [];
  if (profile.needsFinancialAid) contextFlags.push('needAid');
  if (profile.firstGeneration) contextFlags.push('firstGeneration');
  if ((profile.legacy?.length ?? 0) > 0) contextFlags.push('legacy');
  if (profile.grade === 'GAP_YEAR') contextFlags.push('gapYear');
  if (hasCoreStandardizedTest(profile)) contextFlags.push('testSubmit');
  else contextFlags.push('testOptional');

  const constraints = buildConstraints(profile, locale, isInternational);
  const highSchool = profile.education.find(
    (education) => education.schoolType === 'HIGH_SCHOOL',
  )?.highSchool;
  const educationEntries = profile.education.map((education) => ({
    school: education.schoolName,
    schoolType: education.schoolType,
    highSchoolId: education.highSchoolId,
  }));
  const highSchoolInfo = highSchool
    ? {
        name: highSchool.name,
        tier: highSchool.tier,
        type: highSchool.type,
        country: highSchool.country,
        state: highSchool.state,
      }
    : null;

  return {
    applicantType: resolveApplicantType(isInternational, profile),
    intendedMajors: [
      profile.intendedMajor,
      profile.targetMajor,
      profile.secondMajor,
    ]
      .filter((value): value is string => Boolean(value))
      .slice(0, 3),
    testStrategy: hasCoreStandardizedTest(profile) ? 'submit' : 'testOptional',
    contextFlags,
    constraints,
    grade: profile.grade ?? undefined,
    educationSystem: profile.educationSystem ?? undefined,
    nationality: profile.nationality ?? undefined,
    citizenship: profile.citizenship ?? undefined,
    countryOfResidence: profile.countryOfResidence ?? undefined,
    highSchoolContext:
      formatHighSchoolContext(educationEntries, highSchoolInfo, locale) ??
      undefined,
  };
}

export function buildPortfolioSummary(
  locale: string,
  state: AnalysisState,
  schoolListItems: LoadedSchoolListItem[],
  focusSchools: LoadedSchoolListItem[],
  predictionMap: Map<string, LoadedPrediction>,
): ApplicationAnalysisPortfolioSummary {
  const balance = resolvePortfolioBalance(schoolListItems, predictionMap);
  const missingPredictions = focusSchools.filter(
    (item) => !predictionMap.has(item.schoolId),
  ).length;
  const isZh = locale === 'zh';

  if (state === 'noTargetSchools') {
    return {
      verdict: isZh
        ? '还没有目标校清单，当前只能停留在档案层面的分析。'
        : 'There is no target-school list yet, so the analysis remains profile-level.',
      balance: 'insufficient',
      keyReasons: [
        isZh
          ? '先补 3-5 所目标校和申请轮次，再进入学校级策略判断。'
          : 'Add 3-5 target schools with rounds before expecting school-level strategy.',
      ],
      riskBoundaries: [],
    };
  }

  if (state === 'noPredictions') {
    return {
      verdict: isZh
        ? '目标校已存在，但重点学校仍缺少最新预测。'
        : 'The target schools exist, but the focus schools still need fresh predictions.',
      balance,
      keyReasons: [
        isZh
          ? `当前仍有 ${missingPredictions} 所重点学校没有可用预测。`
          : `${missingPredictions} focus schools are still missing usable predictions.`,
      ],
      riskBoundaries: [],
    };
  }

  if (state === 'insufficientProfileData') {
    return {
      verdict: isZh
        ? '当前档案信息还不足以支持可信的学校级策略。'
        : 'The current profile is still too thin for reliable school-level strategy.',
      balance: 'insufficient',
      keyReasons: [
        isZh
          ? '先补齐核心档案字段。'
          : 'Complete the core profile fields first.',
      ],
      riskBoundaries: [],
    };
  }

  const verdict = isZh
    ? {
        balanced: '当前清单分布基本均衡，可以进入学校级差距分析。',
        reachHeavy: '当前清单偏冲刺，容错空间偏少。',
        safetyHeavy: '当前清单偏保守，可能存在 undermatch 风险。',
        undermatch: '当前清单偏稳，缺少足够的上探学校。',
        insufficient: '当前学校数仍不足以判断组合。',
      }[balance]
    : {
        balanced:
          'The current list is reasonably balanced and ready for school-level analysis.',
        reachHeavy:
          'The current list leans reach-heavy and leaves limited room for error.',
        safetyHeavy:
          'The current list leans conservative and may create undermatch risk.',
        undermatch:
          'The current list feels too safe and lacks enough upside schools.',
        insufficient:
          'There are still too few schools to judge the list shape reliably.',
      }[balance];

  return {
    verdict,
    balance,
    keyReasons: [
      isZh
        ? '重点学校已有可用预测与政策卡片。'
        : 'The focus schools now have usable predictions and policy cards.',
    ],
    riskBoundaries: [
      ...buildPortfolioRiskBoundaries(schoolListItems, predictionMap, isZh),
      ...(schoolListItems.some((item) => !item.round)
        ? [
            isZh
              ? '部分学校还没有绑定申请轮次，round strategy 仍不完整。'
              : 'Some schools still do not have an application round attached.',
          ]
        : []),
    ],
  };
}

export function buildPolicyCard(
  item: LoadedSchoolListItem,
  profile: LoadedProfile,
  evidence?: SchoolEvidenceByDimension,
): PolicyCardBuildResult {
  const sources: ApplicationAnalysisSourceRef[] = [];
  const evidenceIds: string[] = [];
  const unknowns: string[] = [];

  const testingEvidence = evidence?.TESTING;
  const intlAidEvidence = evidence?.INTL_AID;
  const roundEvidence = evidence?.ROUND;
  const deadlineEvidence = evidence?.OTHER;

  // 3-tier policy fallback (per docs/APPLICATION_ANALYSIS_WORKFLOW_SOP.md):
  //   1. APPROVED SchoolPolicyEvidence -> policySourceQuality = 'REVIEWED'
  //   2. Backend-derived from raw school fields -> 'DERIVED'
  //   3. Nothing -> 'UNKNOWN'
  //
  // `roundContext` already implemented tier 2 via `resolveFirstPartyRoundContext`.
  // `testingPolicy` and `intlAidPolicy` were missing the DERIVED tier — they
  // defaulted straight to UNKNOWN whenever no APPROVED evidence existed. This
  // left 30/50 application-analysis gold cases failing (governance gate) since
  // they ship `school.testingPolicy=BLIND/OPTIONAL/REQUIRED` but no separate
  // TESTING-dimension evidence rows. `policySourceQuality` correctly degrades
  // to 'DERIVED' (not 'REVIEWED') so consumers still see this isn't reviewed
  // evidence — see the test "uses raw school policy fields as a DERIVED-tier
  // fallback".
  const testingPolicy: SchoolTestingPolicy =
    resolveEvidenceTestingPolicy(testingEvidence?.policyValue) ??
    resolveSchoolTestingPolicyValue({
      testingPolicy:
        (item.school as { testingPolicy?: SchoolTestingPolicy | null })
          .testingPolicy ?? null,
      testOptional:
        (item.school as { testOptional?: boolean | null }).testOptional ?? null,
    });
  const intlAidPolicy: SchoolIntlAidPolicy =
    resolveEvidenceIntlAidPolicy(intlAidEvidence?.policyValue) ??
    deriveIntlAidPolicyFromSchool(item.school);
  const roundContext =
    resolveEvidenceRoundContext(roundEvidence?.policyValue) ??
    resolveFirstPartyRoundContext(item, profile);

  const pushSource = (
    source: ApprovedPolicyEvidence | undefined,
    dimension: ApplicationAnalysisSourceRef['dimension'],
    fallbackLabel: string,
  ) => {
    if (!source) return;
    evidenceIds.push(source.id);
    sources.push({
      evidenceId: source.id,
      dimension,
      label: fallbackLabel,
      value: source.policyValue,
      sourceName: source.sourceName,
      sourceUrl: source.sourceUrl ?? undefined,
      sourcePublishedAt: source.sourcePublishedAt?.toISOString(),
    });
  };

  pushSource(testingEvidence, 'TESTING', 'Testing policy');
  pushSource(intlAidEvidence, 'INTL_AID', 'International aid policy');
  pushSource(roundEvidence, 'ROUND', 'Round policy');
  pushSource(deadlineEvidence, 'DEADLINE', 'Deadline');

  if (testingPolicy === 'UNKNOWN') unknowns.push('testingPolicy');
  if (
    resolveApplicantTypeFromProfile(profile) === 'international' &&
    intlAidPolicy === 'UNKNOWN'
  ) {
    unknowns.push('intlAidPolicy');
  }
  if (roundContext === 'UNKNOWN') unknowns.push('roundContext');

  const card: ApplicationAnalysisPolicyCard = {
    testingPolicy,
    intlAidPolicy,
    roundContext,
    policySourceQuality: resolvePolicySourceQuality(
      Boolean(
        testingEvidence || intlAidEvidence || roundEvidence || deadlineEvidence,
      ),
      testingPolicy,
      intlAidPolicy,
      roundContext,
    ),
    standardDeadline: deadlineEvidence?.policyValue ?? undefined,
    evidenceIds: [...new Set(evidenceIds)],
    sources,
    unknowns,
  };

  return { card, unknowns };
}

export function buildDeterministicSchoolResult(
  item: LoadedSchoolListItem,
  prediction: LoadedPrediction | undefined,
  profile: LoadedProfile,
  policyCard: ApplicationAnalysisPolicyCard,
  locale: string,
): ApplicationAnalysisSchoolResult {
  const schoolName = getSchoolDisplayName(item.school, locale);
  const whyThisIsHard = buildWhyThisIsHard(
    item,
    prediction,
    policyCard,
    locale,
  );
  const strengths = buildCompensatingStrengths(prediction, profile, locale);
  const topGaps = buildTopGaps(prediction, locale);
  const nextActions = buildNextActions(item, prediction, locale);
  const hardStopRisks = buildHardStopRisks(
    item,
    prediction,
    profile,
    policyCard,
    locale,
  );
  const evidenceIds = [...new Set(policyCard.evidenceIds)];

  return {
    schoolId: item.schoolId,
    schoolName,
    // Display the EFFECTIVE tier (engine prediction wins for PREDICTED rows;
    // a MANUAL override wins) so the card badge can't contradict the
    // prediction block or the portfolio verdict, which use the same resolver.
    tier: resolveEffectiveTier(item.tier, item.tierSource, prediction?.tier)
      .tier,
    round: item.round ?? profile.applicationRound ?? undefined,
    prediction: prediction
      ? {
          predictionResultId: prediction.id,
          probability: roundNumber(toNumber(prediction.probability) ?? 0, 4),
          probabilityLow: toOptionalRoundedNumber(prediction.probabilityLow, 4),
          probabilityHigh: toOptionalRoundedNumber(
            prediction.probabilityHigh,
            4,
          ),
          tier: normalizePredictionTier(prediction.tier),
          confidence: normalizeConfidence(prediction.confidence),
          updatedAt: prediction.updatedAt.toISOString(),
          roundContext: prediction.applicationRound ?? undefined,
          confidenceReason: prediction.confidenceReason ?? undefined,
        }
      : undefined,
    policyCard,
    assessment: {
      summary:
        prediction?.confidenceReason ??
        (locale === 'zh'
          ? `${schoolName} 当前仍需要把优势压缩成更可执行的申请叙事。`
          : `${schoolName} still requires a tighter and more executable application story.`),
      whyThisIsHard,
      compensatingStrengths: strengths,
      topGaps,
      nextActions,
      // Compatibility-only response field. Application analysis deliberately
      // has no admission-Case input or fallback path.
      historicalSignals: [],
      hardStopRisks,
    },
    evidenceIds,
    unknowns: [...policyCard.unknowns],
  };
}

export function buildFallbackActionPlan(
  profile: LoadedProfile,
  state: AnalysisState,
  schoolListItems: LoadedSchoolListItem[],
  schools: ApplicationAnalysisSchoolResult[],
  locale: string,
): AnalysisActionPlan {
  const isZh = locale === 'zh';
  const schoolActions = schools
    .flatMap((school) => school.assessment.nextActions)
    .slice(0, 3);

  if (state === 'noTargetSchools') {
    return {
      now: [
        isZh
          ? '先补 3-5 所目标校，并为每所学校绑定初始申请轮次。'
          : 'Add 3-5 target schools and attach an initial application round to each.',
      ],
      next90Days: [
        isZh
          ? '补齐目标专业相关活动与奖项，再重新跑学校级分析。'
          : 'Add major-aligned activities and awards, then rerun the school-level analysis.',
      ],
      beforeSubmission: [
        isZh
          ? '提交前重新复盘 reach/target/safety 是否均衡。'
          : 'Re-check whether the reach/target/safety mix is still balanced before submission.',
      ],
    };
  }

  if (state === 'insufficientProfileData') {
    return {
      now: [
        isZh
          ? '先补齐 GPA、标化、活动或奖项中的核心缺口。'
          : 'Fill the core gaps in GPA, testing, activities, or awards first.',
      ],
      next90Days: [
        isZh
          ? '把目标专业和核心活动叙事先稳定下来。'
          : 'Stabilize the intended-major story and core activity narrative.',
      ],
      beforeSubmission: [
        isZh
          ? '在学校级判断前再次确认基础档案完整度。'
          : 'Re-check profile completeness before relying on school-level judgments.',
      ],
    };
  }

  return {
    now: [
      ...schoolActions,
      !hasCoreStandardizedTest(profile)
        ? isZh
          ? '尽快明确 test-submit 还是 test-optional 路线。'
          : 'Decide quickly whether you are pursuing a test-submit or test-optional route.'
        : isZh
          ? '整理一版面向重点学校的主叙事与补充材料清单。'
          : 'Draft a coherent narrative and supporting-material checklist for the focus schools.',
    ].slice(0, 5),
    next90Days: [
      schoolListItems.some((item) => !item.round)
        ? isZh
          ? '补齐所有重点学校轮次，并固定 ED/EA 资源优先级。'
          : 'Attach rounds to all focus schools and lock the ED/EA priority.'
        : isZh
          ? '围绕重点学校的最大短板安排 1-2 个可验证成果。'
          : 'Create 1-2 verifiable wins that directly address the biggest school-level gaps.',
    ],
    beforeSubmission: [
      isZh
        ? '提交前再次核对每所重点学校的概率、轮次和政策卡片。'
        : 'Before submission, re-check each focus school’s probability, round, and policy card.',
    ],
  };
}

/**
 * Map an internal unknown code (e.g. `testingPolicy`) to a human-readable,
 * locale-aware label before it reaches a user-facing string. Without this the
 * UI shows raw field-name jargon like "Still unresolved: testingPolicy".
 * Falls back to a de-camelCased form so a future code never leaks raw.
 */
export function humanizeUnknownLabel(code: string, locale: string): string {
  const isZh = locale === 'zh';
  const labels: Record<string, { en: string; zh: string }> = {
    testingPolicy: { en: 'standardized-test policy', zh: '标化考试政策' },
    intlAidPolicy: {
      en: 'international financial-aid policy',
      zh: '国际生资助政策',
    },
    roundContext: { en: 'application round', zh: '申请轮次' },
    // Emitted by the degraded / insufficient-profile serve paths
    // (buildInsufficientResponse) — first-party codes, must stay mapped so a
    // zh user never sees a mixed-language "仍有未确认项：prediction unavailable".
    predictionUnavailable: { en: 'admission prediction', zh: '录取概率预测' },
    insufficientProfileData: {
      en: 'core profile information',
      zh: '核心档案信息',
    },
  };
  const known = labels[code];
  if (known) return isZh ? known.zh : known.en;
  // Fallback: split camelCase / snake_case into spaced words.
  return code
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim();
}

export function buildApplicantFacingSummary(input: {
  locale: string;
  status: ApplicationAnalysisStatus;
  generatedAt: string;
  dataQuality: AnalysisDataQuality;
  state: AnalysisState;
  degradedReason?: string;
  portfolioSummary: ApplicationAnalysisPortfolioSummary;
  schools: ApplicationAnalysisSchoolResult[];
  actionPlan: AnalysisActionPlan;
  unknowns: string[];
}): {
  overallVerdict: string;
  schoolCards: ApplicationAnalysisSchoolResult[];
  topReasons: string[];
  topRisks: string[];
  nextActions: string[];
  evidenceSummary: ApplicationAnalysisEvidenceSummaryItem[];
  confidenceSummary: ApplicationAnalysisConfidenceSummary;
  freshnessSummary: ApplicationAnalysisFreshnessSummary;
} {
  const isZh = input.locale === 'zh';
  const schoolCards = input.schools;
  const topReasons = dedupeStrings([
    ...input.portfolioSummary.keyReasons,
    ...schoolCards.flatMap((school) => school.assessment.compensatingStrengths),
    ...schoolCards.flatMap((school) => school.assessment.historicalSignals),
  ]).slice(0, 5);
  const topRisks = dedupeStrings([
    ...input.portfolioSummary.riskBoundaries,
    ...schoolCards.flatMap((school) => school.assessment.hardStopRisks),
    ...input.unknowns.map((unknown) => {
      const label = humanizeUnknownLabel(unknown, input.locale);
      return isZh ? `仍有未确认项：${label}` : `Still unresolved: ${label}`;
    }),
  ]).slice(0, 5);
  const nextActions = dedupeStrings([
    ...input.actionPlan.now,
    ...schoolCards.flatMap((school) => school.assessment.nextActions),
  ]).slice(0, 5);

  return {
    overallVerdict: input.portfolioSummary.verdict,
    schoolCards,
    topReasons,
    topRisks,
    nextActions,
    evidenceSummary: buildEvidenceSummary(
      input.locale,
      schoolCards,
      input.unknowns,
    ),
    confidenceSummary: buildConfidenceSummary({
      locale: input.locale,
      status: input.status,
      dataQuality: input.dataQuality,
      state: input.state,
      schools: schoolCards,
      unknowns: input.unknowns,
    }),
    freshnessSummary: buildFreshnessSummary({
      locale: input.locale,
      status: input.status,
      generatedAt: input.generatedAt,
      degradedReason: input.degradedReason,
    }),
  };
}

export function buildEvidenceMap(
  evidences: ApprovedPolicyEvidence[],
): SchoolEvidenceMap {
  const map: SchoolEvidenceMap = new Map();

  for (const evidence of evidences) {
    const existing = map.get(evidence.schoolId) ?? {};
    if (!existing[evidence.policyDimension]) {
      existing[evidence.policyDimension] = evidence;
      map.set(evidence.schoolId, existing);
    }
  }

  return map;
}

export function normalizeRound(round: string | undefined): string | undefined {
  if (!round) return undefined;
  const token = round.trim().toUpperCase();
  switch (token) {
    case 'EARLY DECISION':
      return 'ED';
    case 'EARLY DECISION II':
      return 'ED2';
    case 'EARLY ACTION':
      return 'EA';
    case 'REGULAR DECISION':
      return 'RD';
    case 'RESTRICTIVE EARLY ACTION':
      return 'REA';
    case 'SINGLE CHOICE EARLY ACTION':
      return 'SCEA';
    default:
      return token;
  }
}

function resolveSchoolListTierRank(tier: SchoolTier): number {
  switch (tier) {
    case 'REACH':
      return 0;
    case 'TARGET':
      return 1;
    case 'SAFETY':
      return 2;
    default:
      return 3;
  }
}

function resolvePrimaryGpa(profile: LoadedProfile): number | null {
  const profileGpa = toNumber(profile.gpa);
  if (profileGpa != null) return profileGpa;

  const semesterGpas = profile.semesterGpas
    .map((semester) => toNumber(semester.gpa))
    .filter((value): value is number => value != null);
  if (semesterGpas.length === 0) return null;

  return roundNumber(
    semesterGpas.reduce((sum, value) => sum + value, 0) / semesterGpas.length,
    2,
  );
}

function hasCoreStandardizedTest(profile: LoadedProfile): boolean {
  return profile.testScores.some((score) =>
    ['SAT', 'ACT'].includes(score.type),
  );
}

function buildConstraints(
  profile: LoadedProfile,
  locale: string,
  isInternational: boolean,
): string[] {
  const isZh = locale === 'zh';
  const constraints: string[] = [];
  if (isInternational) {
    constraints.push(
      isZh ? '以国际生身份申请。' : 'Applying as an international student.',
    );
  }
  if (profile.needsFinancialAid) {
    constraints.push(isZh ? '需要资助支持。' : 'Needs financial aid support.');
  }
  if (!hasCoreStandardizedTest(profile)) {
    constraints.push(
      isZh ? '当前没有 SAT/ACT 成绩。' : 'Currently has no SAT/ACT score.',
    );
  }
  if (profile.grade === 'GAP_YEAR') {
    constraints.push(isZh ? '当前处于 gap year。' : 'Currently in a gap year.');
  }
  return constraints;
}

function resolveApplicantType(
  isInternational: boolean,
  profile: LoadedProfile,
): AnalysisApplicantType {
  if (isInternational) return 'international';
  if (profile.citizenship === 'US' || profile.countryOfResidence === 'US') {
    return 'domestic';
  }
  return 'unknown';
}

function resolveApplicantTypeFromProfile(
  profile: LoadedProfile,
): AnalysisApplicantType {
  return resolveApplicantType(
    Boolean(
      profile.citizenship &&
      profile.countryOfResidence &&
      profile.citizenship !== 'US' &&
      profile.countryOfResidence !== 'US',
    ),
    profile,
  );
}

/** A high-probability admit floor below this is treated as "no real safety". */
const SAFETY_FLOOR_PROBABILITY = 0.5;

interface ResolvedTierCounts {
  counts: Record<'REACH' | 'TARGET' | 'SAFETY', number>;
  /** Schools whose tier could actually be resolved (prediction or MANUAL). */
  resolved: number;
}

/**
 * Count schools by their EFFECTIVE tier. The engine prediction wins for
 * PREDICTED rows; an explicit MANUAL tier wins; a PREDICTED row with no usable
 * prediction is a stale default placeholder (`SchoolListItem.tier` defaults to
 * TARGET) and is EXCLUDED — counting it would let the placeholder fake a
 * balanced list. This is the whole point of the fix: list shape = the engine's
 * view of admit odds, not the labels the student happened to type.
 */
function resolveEffectiveTierCounts(
  schoolListItems: LoadedSchoolListItem[],
  predictionMap: Map<string, LoadedPrediction>,
): ResolvedTierCounts {
  const counts = { REACH: 0, TARGET: 0, SAFETY: 0 };
  let resolved = 0;
  for (const item of schoolListItems) {
    const predictionTier = predictionMap.get(item.schoolId)?.tier ?? null;
    const { tier, tierIsEstimated } = resolveEffectiveTier(
      item.tier,
      item.tierSource,
      predictionTier,
    );
    if (tierIsEstimated) continue; // stale PREDICTED placeholder — not a signal
    counts[tier] += 1;
    resolved += 1;
  }
  return { counts, resolved };
}

function resolvePortfolioBalance(
  schoolListItems: LoadedSchoolListItem[],
  predictionMap: Map<string, LoadedPrediction>,
): PortfolioBalance {
  const { counts, resolved } = resolveEffectiveTierCounts(
    schoolListItems,
    predictionMap,
  );
  // Need ≥3 schools with a *resolvable* effective tier to judge the list shape.
  if (resolved < 3) return 'insufficient';

  if (counts.REACH >= counts.TARGET + counts.SAFETY) return 'reachHeavy';
  if (counts.SAFETY >= counts.REACH + counts.TARGET) return 'safetyHeavy';
  // undermatch = no reaches AND a real safety floor — the student is leaving
  // ambition on the table, which is only fair advice when they're actually safe.
  if (counts.REACH === 0 && counts.SAFETY >= counts.TARGET) return 'undermatch';
  return 'balanced';
}

/**
 * Portfolio-level risk lines grounded in the engine's predictions, not the
 * student's self-assigned tiers:
 *   1. No real safety floor (≥3 resolvable tiers, 0 predict as safety).
 *   2. No likely admit anywhere (top predicted probability < ~50%).
 *   3. Per-school "your safety isn't safe" — a MANUAL claim the engine contradicts.
 * (1)/(2) key off the engine; (3) only fires for MANUAL rows, where the user
 * made a deliberate claim worth checking. Round is already baked into each
 * prediction's probability, so these are round-aware for free.
 */
function buildPortfolioRiskBoundaries(
  schoolListItems: LoadedSchoolListItem[],
  predictionMap: Map<string, LoadedPrediction>,
  isZh: boolean,
): string[] {
  const lines: string[] = [];
  const { counts, resolved } = resolveEffectiveTierCounts(
    schoolListItems,
    predictionMap,
  );

  // (1) No real safety floor.
  if (resolved >= 3 && counts.SAFETY === 0) {
    lines.push(
      isZh
        ? '当前没有一所学校预测为"保底"区间——提交前至少补一所录取概率很高的真保底校。'
        : 'None of your current schools predict as a true safety. Add at least one high-probability school before you submit.',
    );
  }

  // (2) No likely admit anywhere — top predicted probability below the floor.
  const probabilities = schoolListItems
    .map((item) => predictionMap.get(item.schoolId))
    .filter((p): p is LoadedPrediction => Boolean(p))
    .map((p) => toNumber(p.probability) ?? 0);
  if (
    resolved >= 3 &&
    probabilities.length >= 3 &&
    Math.max(...probabilities) < SAFETY_FLOOR_PROBABILITY
  ) {
    lines.push(
      isZh
        ? '清单里最高的预测录取概率也低于约 50%——目前每一所都算冲刺，几乎没有稳妥的落点。'
        : 'Even your highest predicted admit chance is below ~50% — every school is effectively a reach, with no reliable landing spot.',
    );
  }

  // (3) Per-school "you claimed safer than the engine predicts" (MANUAL only).
  let targetPredictsReach = 0;
  for (const item of schoolListItems) {
    if (item.tierSource !== 'MANUAL') continue;
    const predicted = predictionMap.get(item.schoolId)?.tier ?? null;
    const { predictedTier } = resolveEffectiveTier(
      item.tier,
      item.tierSource,
      predicted,
    );
    if (!predictedTier) continue;
    const name =
      item.school.nameZh && isZh ? item.school.nameZh : item.school.name;
    if (item.tier === 'SAFETY' && predictedTier === 'REACH') {
      lines.push(
        isZh
          ? `你把 ${name} 标成了保底，但它的预测落在冲刺区间——别把它当退路，再补一所真正稳的学校。`
          : `You've marked ${name} as a safety, but it predicts in reach territory — don't count on it as a fallback; add a school where you're genuinely likely to be admitted.`,
      );
    } else if (item.tier === 'SAFETY' && predictedTier === 'TARGET') {
      lines.push(
        isZh
          ? `${name} 更接近匹配校而非真正的保底——可以保留，但确保清单里至少有一两所概率很高的保底。`
          : `${name} is closer to a match than a true safety — keep it, but make sure one or two schools on your list are clear safeties.`,
      );
    } else if (item.tier === 'TARGET' && predictedTier === 'REACH') {
      targetPredictsReach += 1;
    }
  }
  if (targetPredictsReach >= 2) {
    lines.push(
      isZh
        ? `有 ${targetPredictsReach} 所你列为匹配校的学校预测更像冲刺——清单实际比看上去更偏冲刺。`
        : `${targetPredictsReach} schools you listed as matches predict more like reaches — your list leans further toward reaches than it looks.`,
    );
  }

  return lines;
}

function resolveEvidenceTestingPolicy(
  value: string | undefined | null,
): SchoolTestingPolicy | null {
  const token = value?.trim().toUpperCase();
  switch (token) {
    case 'REQUIRED':
    case 'OPTIONAL':
    case 'BLIND':
      return token;
    default:
      return null;
  }
}

function resolveEvidenceIntlAidPolicy(
  value: string | undefined | null,
): SchoolIntlAidPolicy | null {
  const token = value?.trim().toUpperCase();
  switch (token) {
    case 'NEED_BLIND':
    case 'NEED_AWARE':
      return token;
    default:
      return null;
  }
}

/**
 * DERIVED-tier fallback for intlAidPolicy when no APPROVED evidence row exists.
 * Reads School.needBlindInternational (Boolean | null):
 *   true  -> 'NEED_BLIND'
 *   false -> 'NEED_AWARE'
 *   null  -> 'UNKNOWN'
 * Mirrors how `resolveFirstPartyRoundContext` provides a DERIVED-tier fallback
 * for roundContext from the school list item.
 */
function deriveIntlAidPolicyFromSchool(school: {
  needBlindInternational?: boolean | null;
}): SchoolIntlAidPolicy {
  if (school.needBlindInternational === true) return 'NEED_BLIND';
  if (school.needBlindInternational === false) return 'NEED_AWARE';
  return 'UNKNOWN';
}

function resolveEvidenceRoundContext(
  value: string | undefined | null,
): SchoolRoundContext | null {
  const token = normalizeRound(value ?? undefined);
  switch (token) {
    case 'ED':
    case 'ED2':
    case 'EA':
    case 'REA':
    case 'SCEA':
    case 'RD':
    case 'UC':
      return token;
    default:
      return null;
  }
}

function resolveFirstPartyRoundContext(
  item: LoadedSchoolListItem,
  profile: LoadedProfile,
): SchoolRoundContext {
  const normalized = normalizeRound(
    item.round ?? profile.applicationRound ?? undefined,
  );
  switch (normalized) {
    case 'ED':
    case 'ED2':
    case 'EA':
    case 'REA':
    case 'SCEA':
    case 'RD':
    case 'UC':
      return normalized;
    default:
      return 'UNKNOWN';
  }
}

function resolvePolicySourceQuality(
  hasEvidence: boolean,
  testingPolicy: SchoolTestingPolicy,
  intlAidPolicy: SchoolIntlAidPolicy,
  roundContext: SchoolRoundContext,
): 'REVIEWED' | 'DERIVED' | 'UNKNOWN' {
  if (hasEvidence) return 'REVIEWED';
  if (
    testingPolicy !== 'UNKNOWN' ||
    intlAidPolicy !== 'UNKNOWN' ||
    roundContext !== 'UNKNOWN'
  ) {
    return 'DERIVED';
  }
  return 'UNKNOWN';
}

function buildWhyThisIsHard(
  item: LoadedSchoolListItem,
  prediction: LoadedPrediction | undefined,
  policyCard: ApplicationAnalysisPolicyCard,
  locale: string,
): string[] {
  const isZh = locale === 'zh';
  const factors = normalizeFactorStrings(prediction?.factors, 'negative');
  const fallback = prediction
    ? isZh
      ? `${item.school.nameZh || item.school.name} 当前仍是高波动学校。`
      : `${item.school.name} remains a high-variance school for this profile.`
    : isZh
      ? `${item.school.nameZh || item.school.name} 当前还缺少最新预测。`
      : `${item.school.name} is still missing a fresh prediction.`;

  const reasons = factors.length > 0 ? factors : [fallback];
  if (policyCard.testingPolicy === 'REQUIRED') {
    reasons.push(
      isZh
        ? '该校测试政策更严格，标化策略会直接影响判断。'
        : 'The testing policy is stricter here, so test strategy directly matters.',
    );
  }
  return dedupeStrings(reasons).slice(0, 4);
}

function buildCompensatingStrengths(
  prediction: LoadedPrediction | undefined,
  profile: LoadedProfile,
  locale: string,
): string[] {
  const isZh = locale === 'zh';
  const factors = normalizeFactorStrings(prediction?.factors, 'positive');
  if (factors.length > 0) return factors.slice(0, 4);

  const strengths: string[] = [];
  const gpa = resolvePrimaryGpa(profile);
  if (gpa != null && gpa >= 3.8) {
    strengths.push(isZh ? 'GPA 基线较强。' : 'The GPA baseline is strong.');
  }
  if (profile.awards.length > 0) {
    strengths.push(
      isZh
        ? '已有外部奖项或认证支撑。'
        : 'There is external validation from awards or recognition.',
    );
  }
  if (profile.activities.length > 0) {
    strengths.push(
      isZh
        ? '已有可叙述的活动主线。'
        : 'There is already a narratable activity spine.',
    );
  }
  return strengths.slice(0, 4);
}

function buildTopGaps(
  prediction: LoadedPrediction | undefined,
  locale: string,
): string[] {
  const suggestions = asStringArray(prediction?.suggestions);
  if (suggestions.length > 0) return suggestions.slice(0, 4);
  return [
    locale === 'zh'
      ? '需要把学校级短板写得更具体。'
      : 'The school-specific gaps still need to be made more concrete.',
  ];
}

function buildNextActions(
  item: LoadedSchoolListItem,
  prediction: LoadedPrediction | undefined,
  locale: string,
): string[] {
  const isZh = locale === 'zh';
  const actions = asStringArray(prediction?.suggestions).slice(0, 3);

  if (!item.round) {
    actions.unshift(
      isZh
        ? '先明确这所学校的申请轮次。'
        : 'Set the application round for this school first.',
    );
  }
  if (!prediction) {
    actions.unshift(
      isZh
        ? '先刷新该校预测，再决定是否保留为重点学校。'
        : 'Refresh the prediction before deciding whether this remains a focus school.',
    );
  }
  return dedupeStrings(actions).slice(0, 4);
}

function buildHardStopRisks(
  item: LoadedSchoolListItem,
  prediction: LoadedPrediction | undefined,
  profile: LoadedProfile,
  policyCard: ApplicationAnalysisPolicyCard,
  locale: string,
): string[] {
  const isZh = locale === 'zh';
  const risks: string[] = [];
  if (!item.round) {
    risks.push(
      isZh
        ? '该校尚未绑定申请轮次，任何 ED/EA/RD 判断都不稳定。'
        : 'This school still lacks an application round, so ED/EA/RD strategy is not stable yet.',
    );
  }
  if (!prediction) {
    risks.push(
      isZh
        ? '该校还没有最新预测，当前风险边界仍不完整。'
        : 'There is no fresh prediction for this school yet, so the risk boundary is incomplete.',
    );
  }
  if (
    !hasCoreStandardizedTest(profile) &&
    policyCard.testingPolicy === 'REQUIRED'
  ) {
    risks.push(
      isZh
        ? '该校不是 test-optional，缺少 SAT/ACT 会直接压缩竞争力。'
        : 'This school is not test-optional, so missing SAT/ACT directly compresses competitiveness.',
    );
  }
  if (
    profile.needsFinancialAid &&
    resolveApplicantTypeFromProfile(profile) === 'international' &&
    policyCard.intlAidPolicy === 'NEED_AWARE'
  ) {
    risks.push(
      isZh
        ? '国际生且需要资助，这会显著收紧该校的录取窗口。'
        : 'International aid need materially tightens the admit window at this school.',
    );
  }
  return risks.slice(0, 4);
}

function buildEvidenceSummary(
  locale: string,
  schools: ApplicationAnalysisSchoolResult[],
  unknowns: string[],
): ApplicationAnalysisEvidenceSummaryItem[] {
  const isZh = locale === 'zh';
  const predictionFacts = schools
    .filter((school) => school.prediction?.probability != null)
    .slice(0, 3)
    .map((school) => ({
      type: 'PREDICTION_FACT' as const,
      label: isZh
        ? `${school.schoolName} 预测事实`
        : `${school.schoolName} prediction fact`,
      detail: isZh
        ? `${school.round ?? 'RD'} 概率约 ${Math.round((school.prediction?.probability ?? 0) * 100)}%，置信度 ${school.prediction?.confidence ?? 'unknown'}。`
        : `${school.round ?? 'RD'} admit probability is about ${Math.round((school.prediction?.probability ?? 0) * 100)}% with ${school.prediction?.confidence ?? 'unknown'} confidence.`,
      schoolId: school.schoolId,
      schoolName: school.schoolName,
    }));
  const policyEvidence = schools
    .flatMap((school) =>
      school.policyCard.sources.slice(0, 2).map((source) => ({
        type: 'POLICY_EVIDENCE' as const,
        label: isZh
          ? `${school.schoolName} 政策证据`
          : `${school.schoolName} policy evidence`,
        detail: `${source.label}: ${source.value}`,
        schoolId: school.schoolId,
        schoolName: school.schoolName,
        sourceName: source.sourceName,
        sourceUrl: source.sourceUrl,
        sourcePublishedAt: source.sourcePublishedAt,
      })),
    )
    .slice(0, 3);
  const derivedJudgments = schools
    .filter((school) => school.assessment.summary.trim())
    .slice(0, 2)
    .map((school) => ({
      type: 'DERIVED_JUDGMENT' as const,
      label: isZh
        ? `${school.schoolName} 推导判断`
        : `${school.schoolName} derived judgment`,
      detail: school.assessment.summary,
      schoolId: school.schoolId,
      schoolName: school.schoolName,
    }));
  const unknownEvidence = dedupeStrings([
    ...unknowns,
    ...schools.flatMap((school) => school.policyCard.unknowns),
  ])
    .slice(0, 2)
    .map((unknown) => {
      const readable = humanizeUnknownLabel(unknown, locale);
      return {
        type: 'UNKNOWN' as const,
        label: isZh ? '待确认项' : 'Unknown',
        detail: isZh
          ? `仍需人工确认：${readable}`
          : `Still requires confirmation: ${readable}`,
      };
    });

  return [
    ...predictionFacts,
    ...policyEvidence,
    ...derivedJudgments,
    ...unknownEvidence,
  ].slice(0, 8);
}

function buildConfidenceSummary(input: {
  locale: string;
  status: ApplicationAnalysisStatus;
  dataQuality: AnalysisDataQuality;
  state: AnalysisState;
  schools: ApplicationAnalysisSchoolResult[];
  unknowns: string[];
}): ApplicationAnalysisConfidenceSummary {
  const isZh = input.locale === 'zh';
  const predictionConfidence = input.schools
    .map((school) => school.prediction?.confidence)
    .filter((value): value is 'low' | 'medium' | 'high' => Boolean(value));
  const highOrMediumPredictionCount = predictionConfidence.filter(
    (value) => value === 'high' || value === 'medium',
  ).length;
  const signals = dedupeStrings([
    isZh
      ? `证据质量：${input.dataQuality}`
      : `Data quality: ${input.dataQuality}`,
    isZh
      ? `重点学校数：${input.schools.length}`
      : `Focus schools: ${input.schools.length}`,
    input.unknowns.length > 0
      ? isZh
        ? `未确认项：${input.unknowns.length}`
        : `Unknowns: ${input.unknowns.length}`
      : isZh
        ? '当前没有额外未确认项。'
        : 'No additional unknowns are currently blocking the analysis.',
  ]).slice(0, 3);

  let level: ApplicationAnalysisConfidenceSummary['level'] = 'medium';
  if (
    input.status === 'degraded' ||
    input.dataQuality === 'insufficient' ||
    input.state !== 'ready'
  ) {
    level = 'low';
  } else if (
    input.dataQuality === 'high' &&
    input.unknowns.length <= Math.max(1, input.schools.length) &&
    highOrMediumPredictionCount >=
      Math.max(1, Math.ceil(input.schools.length / 2))
  ) {
    level = 'high';
  }

  const summary =
    level === 'high'
      ? isZh
        ? '当前结论有较完整的档案、预测和政策证据支撑，可直接作为顾问卡片使用。'
        : 'The current verdict is backed strongly enough to be used directly as a counselor copilot card.'
      : level === 'medium'
        ? isZh
          ? '当前结论可用于方向判断，但仍应结合未确认项继续补证。'
          : 'The current verdict is directionally usable, but the remaining unknowns should still be closed.'
        : isZh
          ? '当前结论只适合作为保守参考，优先补齐关键资料后再复跑。'
          : 'The current verdict should be treated as a conservative reference until the key missing inputs are filled in and rerun.';

  return {
    level,
    summary,
    signals,
  };
}

function buildFreshnessSummary(input: {
  locale: string;
  status: ApplicationAnalysisStatus;
  generatedAt: string;
  degradedReason?: string;
}): ApplicationAnalysisFreshnessSummary {
  const isZh = input.locale === 'zh';
  const generatedAt = formatSummaryDate(input.generatedAt);
  const summary =
    input.status === 'cached'
      ? isZh
        ? `当前展示的是 ${generatedAt} 生成的缓存分析，适合快速查看稳定结论。`
        : `This is a cached analysis generated on ${generatedAt}, suitable for a stable quick read.`
      : input.status === 'degraded'
        ? isZh
          ? `当前结果已降级输出${input.degradedReason ? `（${input.degradedReason}）` : ''}，只保留保守结论和补资料建议。`
          : `This result was degraded${input.degradedReason ? ` (${input.degradedReason})` : ''} and only keeps conservative conclusions plus data-completion advice.`
        : isZh
          ? `当前展示的是 ${generatedAt} 生成的最新完整分析。`
          : `This is the latest fully generated analysis from ${generatedAt}.`;

  return {
    status: input.status,
    summary,
    generatedAt: input.generatedAt,
  };
}

function formatSummaryDate(value: string): string {
  if (!value) return '';
  return value.split('T')[0] ?? value;
}

function normalizeFactorStrings(
  factors: Prisma.JsonValue | null | undefined,
  impact: 'positive' | 'negative',
): string[] {
  if (!Array.isArray(factors)) return [];
  const results: string[] = [];
  for (const entry of factors as unknown[]) {
    if (!isRecord(entry)) continue;
    if (
      typeof entry.impact !== 'string' ||
      entry.impact.toLowerCase() !== impact
    )
      continue;
    const detail = typeof entry.detail === 'string' ? entry.detail.trim() : '';
    if (detail) results.push(detail);
    if (results.length >= 4) break;
  }
  return results;
}

function asStringArray(
  value: Prisma.JsonValue | string[] | null | undefined,
): string[] {
  if (!Array.isArray(value)) return [];
  const strings: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (trimmed) strings.push(trimmed);
  }
  return strings;
}

function normalizePredictionTier(
  tier: string | null | undefined,
): 'reach' | 'match' | 'safety' | undefined {
  const token = String(tier ?? '')
    .trim()
    .toLowerCase();
  if (token === 'reach') return 'reach';
  if (token === 'match' || token === 'target') return 'match';
  if (token === 'safety') return 'safety';
  return undefined;
}

function normalizeConfidence(
  confidence: string | null | undefined,
): 'low' | 'medium' | 'high' | undefined {
  const token = String(confidence ?? '')
    .trim()
    .toLowerCase();
  if (token === 'low' || token === 'medium' || token === 'high') return token;
  return undefined;
}

function toNumber(
  value: Prisma.Decimal | number | null | undefined,
): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toOptionalRoundedNumber(
  value: Prisma.Decimal | number | null | undefined,
  digits = 2,
): number | undefined {
  const numeric = toNumber(value);
  return numeric == null ? undefined : roundNumber(numeric, digits);
}

function roundNumber(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
