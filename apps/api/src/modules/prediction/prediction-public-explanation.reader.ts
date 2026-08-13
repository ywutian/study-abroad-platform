import type {
  ConfidenceLevel,
  PredictionFactor,
  PredictionPublicExplanation,
  PredictionSourceSummary,
  SupportedLocale,
  TierType,
} from '@study-abroad/shared';
import { getSchoolDisplayName } from '@study-abroad/shared/utils';
import { buildPredictionPublicExplanation } from './prediction-public-explanation';

export function readStoredPublicExplanation(
  rowValue: unknown,
  locale: SupportedLocale,
  schoolValue?: unknown,
): PredictionPublicExplanation {
  const row =
    typeof rowValue === 'object' && rowValue !== null
      ? (rowValue as Record<string, unknown>)
      : {};
  const school =
    typeof schoolValue === 'object' && schoolValue !== null
      ? (schoolValue as Record<string, unknown>)
      : null;
  const servedTrace =
    typeof row.servedTrace === 'object' && row.servedTrace !== null
      ? (row.servedTrace as Record<string, unknown>)
      : {};
  const publicExplanation =
    typeof servedTrace.publicExplanation === 'object' &&
    servedTrace.publicExplanation !== null
      ? (servedTrace.publicExplanation as Record<string, unknown>)
      : {};
  const llm =
    typeof publicExplanation.llm === 'object' && publicExplanation.llm !== null
      ? (publicExplanation.llm as Record<string, unknown>)
      : {};
  const stored = publicExplanation.rules ?? llm.publicExplanation;
  if (typeof stored === 'object' && stored !== null) {
    const candidate = stored as Record<string, unknown>;
    if (
      typeof candidate.headline === 'string' &&
      Array.isArray(candidate.reasons) &&
      candidate.reasons.every((item) => typeof item === 'string') &&
      typeof candidate.dataSupportLabel === 'string' &&
      ['strong', 'moderate', 'limited'].includes(
        String(candidate.dataSupportLevel),
      ) &&
      Array.isArray(candidate.caveats) &&
      candidate.caveats.every((item) => typeof item === 'string') &&
      ['rules', 'llm'].includes(String(candidate.source))
    ) {
      return candidate as unknown as PredictionPublicExplanation;
    }
  }

  const schoolIdentity = school
    ? {
        name: typeof school.name === 'string' ? school.name : '',
        nameZh: typeof school.nameZh === 'string' ? school.nameZh : null,
      }
    : null;
  const tier = ['reach', 'match', 'safety', 'unknown'].includes(
    String(row.tier),
  )
    ? (row.tier as TierType)
    : undefined;
  const confidence = ['high', 'medium', 'low'].includes(String(row.confidence))
    ? (row.confidence as ConfidenceLevel)
    : undefined;

  return buildPredictionPublicExplanation({
    locale,
    schoolName: schoolIdentity
      ? getSchoolDisplayName(schoolIdentity, locale)
      : typeof row.schoolName === 'string'
        ? row.schoolName
        : undefined,
    probability: row.probability != null ? Number(row.probability) : null,
    probabilityLow:
      row.probabilityLow != null ? Number(row.probabilityLow) : undefined,
    probabilityHigh:
      row.probabilityHigh != null ? Number(row.probabilityHigh) : undefined,
    tier,
    confidence,
    factors: Array.isArray(row.factors)
      ? (row.factors as PredictionFactor[])
      : [],
    suggestions: Array.isArray(row.suggestions)
      ? row.suggestions.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
    sourceSummary: Array.isArray(row.sourceSummary)
      ? (row.sourceSummary as PredictionSourceSummary[])
      : [],
    uncertaintyReasons: Array.isArray(row.uncertaintyReasons)
      ? row.uncertaintyReasons.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
    predictionMethod:
      servedTrace.engine === 'counselor'
        ? 'counselor'
        : typeof row.predictionMethod === 'string'
          ? row.predictionMethod
          : 'fusion',
    schoolAcceptanceRate:
      school?.acceptanceRate != null
        ? Number(school.acceptanceRate)
        : undefined,
  });
}
