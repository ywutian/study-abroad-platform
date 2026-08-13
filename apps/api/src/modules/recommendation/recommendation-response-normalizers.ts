import { Prisma } from '@prisma/client';
import { RecommendationAnalysisDto, RecommendedSchoolDto } from './dto';

type JsonRecord = Record<string, unknown>;

export function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function boundedNumber(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number)
    ? Math.min(100, Math.max(0, number))
    : fallback;
}

export function normalizeRecommendation(
  value: unknown,
): RecommendedSchoolDto | null {
  if (!isJsonRecord(value) || typeof value.schoolName !== 'string') return null;
  const tier =
    value.tier === 'reach' || value.tier === 'match' || value.tier === 'safety'
      ? value.tier
      : 'match';
  const recommendedMajors = Array.isArray(value.recommendedMajors)
    ? value.recommendedMajors.slice(0, 3).flatMap((major) => {
        if (typeof major === 'string') return [{ name: major, reason: '' }];
        if (!isJsonRecord(major) || typeof major.name !== 'string') return [];
        return [
          {
            name: major.name,
            reason: typeof major.reason === 'string' ? major.reason : '',
          },
        ];
      })
    : [];
  return {
    schoolName: value.schoolName,
    tier,
    estimatedProbability: boundedNumber(value.estimatedProbability, 50),
    fitScore: boundedNumber(value.fitScore, 50),
    recommendedMajors,
    reasons: stringArray(value.reasons),
    concerns: stringArray(value.concerns),
    dataPoints: stringArray(value.dataPoints),
  };
}

export function normalizeAnalysis(value: unknown): RecommendationAnalysisDto {
  const record = isJsonRecord(value) ? value : {};
  return {
    strengths: stringArray(record.strengths),
    weaknesses: stringArray(record.weaknesses),
    improvementTips: stringArray(record.improvementTips),
  };
}

export function normalizeSummerPrograms(
  value: unknown,
): { name: string; reason: string }[] {
  return Array.isArray(value)
    ? value.flatMap((program) =>
        isJsonRecord(program) && typeof program.name === 'string'
          ? [
              {
                name: program.name,
                reason:
                  typeof program.reason === 'string' ? program.reason : '',
              },
            ]
          : [],
      )
    : [];
}

export function readStoredAnalysis(value: Prisma.JsonValue): {
  analysis: RecommendationAnalysisDto;
  summerPrograms: { name: string; reason: string }[];
} {
  const record = isJsonRecord(value) ? value : {};
  return {
    analysis: normalizeAnalysis(record),
    summerPrograms: normalizeSummerPrograms(record.summerPrograms),
  };
}
