import type {
  PredictionFactor,
  PredictionPublicExplanation,
  PredictionSourceSummary,
} from '@study-abroad/shared';

type Tier =
  | 'reach'
  | 'match'
  | 'safety'
  | 'unavailable'
  | string
  | null
  | undefined;
type Confidence = 'low' | 'medium' | 'high' | string | null | undefined;

export interface PredictionPublicExplanationInput {
  locale?: string;
  schoolName?: string | null;
  probability?: number | null;
  probabilityLow?: number | null;
  probabilityHigh?: number | null;
  tier?: Tier;
  confidence?: Confidence;
  factors?: PredictionFactor[] | null;
  suggestions?: string[] | null;
  sourceSummary?: PredictionSourceSummary[] | null;
  uncertaintyReasons?: string[] | null;
  predictionMethod?: string | null;
  schoolAcceptanceRate?: number | null;
}

export function buildPredictionPublicExplanation(
  input: PredictionPublicExplanationInput,
): PredictionPublicExplanation {
  const isZh = input.locale !== 'en';
  const tier = input.tier ?? 'match';
  const probability = input.probability;
  const factors = input.factors ?? [];
  const suggestions = input.suggestions ?? [];
  const uncertaintyReasons = input.uncertaintyReasons ?? [];
  const dataSupportLevel = mapDataSupportLevel(input.confidence);
  const dataSupportLabel = getDataSupportLabel(dataSupportLevel, isZh);
  const reasons = buildReasons(input, isZh).slice(0, 3);
  const caveats = buildCaveats(uncertaintyReasons, isZh).slice(0, 2);

  return {
    headline: buildHeadline(tier, probability, input.schoolName, isZh),
    reasons,
    nextAction:
      suggestions[0] ??
      buildDefaultNextAction(tier, dataSupportLevel, factors, isZh),
    dataSupportLabel,
    dataSupportLevel,
    caveats,
    source: 'rules',
    generatedAt: new Date().toISOString(),
  };
}

export function mapDataSupportLevel(
  confidence: Confidence,
): PredictionPublicExplanation['dataSupportLevel'] {
  if (confidence === 'high') return 'strong';
  if (confidence === 'low') return 'limited';
  return 'moderate';
}

function getDataSupportLabel(
  level: PredictionPublicExplanation['dataSupportLevel'],
  isZh: boolean,
): string {
  if (isZh) {
    if (level === 'strong') return '数据较完整';
    if (level === 'limited') return '仅供参考';
    return '信息有限';
  }
  if (level === 'strong') return 'Stronger data';
  if (level === 'limited') return 'Directional only';
  return 'Some gaps';
}

function buildHeadline(
  tier: Tier,
  probability: number | null | undefined,
  schoolName: string | null | undefined,
  isZh: boolean,
): string {
  if (probability == null || tier === 'unavailable') {
    return isZh
      ? `${schoolName ?? '这所学校'}目前缺少足够公开数据，先不要把它当成确定预测。`
      : `${schoolName ?? 'This school'} does not have enough public data for a stable estimate yet.`;
  }
  if (tier === 'reach') {
    return isZh
      ? '这是冲刺型结果：可以申请，但组合里需要搭配更多匹配和保底学校。'
      : 'This is a reach result: worth considering, but balance it with match and likely options.';
  }
  if (tier === 'safety') {
    return isZh
      ? '这是保底型结果：机会相对更稳，但申请材料仍然不能放松。'
      : 'This is a likely result: relatively safer, but the application still needs care.';
  }
  return isZh
    ? '这是匹配型结果：适合作为选校组合里的核心选择之一。'
    : 'This is a match result: a sensible core option for your school list.';
}

function buildReasons(
  input: PredictionPublicExplanationInput,
  isZh: boolean,
): string[] {
  const reasons: string[] = [];
  const probability = input.probability;
  const range =
    input.probabilityLow != null && input.probabilityHigh != null
      ? `${Math.round(input.probabilityLow * 100)}-${Math.round(input.probabilityHigh * 100)}%`
      : null;
  const schoolRate =
    input.schoolAcceptanceRate != null
      ? Number(input.schoolAcceptanceRate)
      : undefined;

  if (probability != null) {
    reasons.push(
      isZh
        ? `当前个人预估约为 ${Math.round(probability * 100)}%${range ? `，合理阅读区间是 ${range}` : ''}。`
        : `Your current personal estimate is about ${Math.round(probability * 100)}%${range ? `, with a practical reading range of ${range}` : ''}.`,
    );
  }

  if (schoolRate != null && probability != null) {
    const schoolRateText =
      schoolRate > 1
        ? `${Math.round(schoolRate)}%`
        : `${Math.round(schoolRate * 100)}%`;
    reasons.push(
      isZh
        ? `系统先参考学校公开录取率（约 ${schoolRateText}），再结合你的档案做个人化修正。`
        : `The estimate starts from the school's public admit rate (about ${schoolRateText}) and then adjusts for your profile. `,
    );
  } else {
    reasons.push(
      isZh
        ? '系统先参考学校公开数据，再结合申请轮次、国际生背景和档案信号做保守修正。'
        : 'The estimate starts from public school data, then applies conservative adjustments for round, international context, and profile signals.',
    );
  }

  const meaningfulFactors = (input.factors ?? []).filter(
    (factor) => factor.impact !== 'neutral',
  );
  const factorReason = meaningfulFactors[0]
    ? summarizeFactor(meaningfulFactors[0], isZh)
    : summarizeNeutralSignals(input.factors ?? [], isZh);
  if (factorReason) reasons.push(factorReason);

  return Array.from(new Set(reasons)).slice(0, 3);
}

function summarizeFactor(
  factor: PredictionFactor,
  isZh: boolean,
): string | null {
  const name = factor.name || '';
  const detail = factor.detail || '';
  const lower = `${name} ${detail}`.toLowerCase();
  const direction = factor.impact === 'negative' ? 'negative' : 'positive';

  if (/international|intl|国际/.test(lower)) {
    return isZh
      ? direction === 'negative'
        ? '国际生身份会让部分学校的竞争更激烈，因此系统做了保守修正。'
        : '你的申请背景与该校国际生情境匹配度较好，因此对结果有一定帮助。'
      : direction === 'negative'
        ? 'International context can make this school more competitive, so the estimate is conservative.'
        : 'Your international context appears to fit this school reasonably well, which helps the estimate.';
  }
  if (/gpa|grade|成绩/.test(lower)) {
    return isZh
      ? direction === 'negative'
        ? '当前成绩信号相对该校竞争池偏弱，是压低结果的主要因素之一。'
        : '当前成绩信号对这所学校有帮助，是支撑结果的主要因素之一。'
      : direction === 'negative'
        ? 'Your academic signal is weaker relative to this applicant pool, which pulls the estimate down.'
        : 'Your academic signal helps support this estimate.';
  }
  if (/test|sat|act|标化/.test(lower)) {
    return isZh
      ? direction === 'negative'
        ? '标化成绩信号相对该校偏弱，可能影响竞争力。'
        : '标化成绩信号对这所学校有帮助。'
      : direction === 'negative'
        ? 'Test-score signal appears weaker for this school and may affect competitiveness.'
        : 'Test-score signal helps for this school.';
  }
  if (/profile|award|activity|活动|奖/.test(lower)) {
    return isZh
      ? '活动、奖项或其他档案信号已被纳入，但只做保守调整。'
      : 'Activities, awards, or other profile signals are included, but only as conservative adjustments.';
  }

  return detail
    ? detail
    : isZh
      ? `${name} 对这条预估有${direction === 'negative' ? '不利' : '有利'}影响。`
      : `${name} has a ${direction} effect on this estimate.`;
}

function summarizeNeutralSignals(
  factors: PredictionFactor[],
  isZh: boolean,
): string | null {
  const baseline = factors.find((factor) =>
    /baseline|anchor|录取率/i.test(`${factor.name} ${factor.detail}`),
  );
  if (baseline) {
    return isZh
      ? '这条结果主要由学校公开录取率和冷启动顾问规则支撑，个体化信号仍然有限。'
      : 'This result is mainly supported by public admit-rate data and cold-start counselor rules; personalized signals are still limited.';
  }
  return null;
}

function buildCaveats(reasons: string[], isZh: boolean): string[] {
  const caveats = new Set<string>();
  caveats.add(
    isZh
      ? '文书、推荐信、面试和学校当年招生偏好不会被完整建模。'
      : 'Essays, recommendations, interviews, and annual institutional priorities are not fully modeled.',
  );

  if (
    reasons.some((reason) => /missing|缺失|not available|limited/i.test(reason))
  ) {
    caveats.add(
      isZh
        ? '部分档案或学校字段仍缺失，补齐后结果可能变化。'
        : 'Some profile or school fields are still missing, so the estimate may move after updates.',
    );
  }

  return Array.from(caveats);
}

function buildDefaultNextAction(
  tier: Tier,
  dataSupportLevel: PredictionPublicExplanation['dataSupportLevel'],
  factors: PredictionFactor[],
  isZh: boolean,
): string {
  if (dataSupportLevel === 'limited') {
    return isZh
      ? '先补齐 GPA、标化、活动和奖项，再重新运行预测。'
      : 'Complete GPA, tests, activities, and awards, then rerun the estimate.';
  }
  const hasNegativeFactor = factors.some(
    (factor) => factor.impact === 'negative',
  );
  if (hasNegativeFactor) {
    return isZh
      ? '优先处理最弱的一项信号，再看概率是否上移。'
      : 'Address the weakest signal first, then check whether the estimate improves.';
  }
  if (tier === 'reach') {
    return isZh
      ? '把它保留为冲刺校，同时补足匹配和保底学校。'
      : 'Keep it as a reach option while adding enough match and likely schools.';
  }
  return isZh
    ? '继续完善文书和学校匹配理由，保持当前优势。'
    : 'Keep strengthening essays and school-fit rationale while preserving current strengths.';
}
