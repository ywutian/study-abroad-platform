import { Prisma } from '@prisma/client';

export interface RankingWeights {
  usNewsRank: number;
  acceptanceRate: number;
  tuition: number;
  avgSalary: number;
}

export interface RankingScoreInput {
  usNewsRank?: number | null;
  acceptanceRate?: number | Prisma.Decimal | null;
  tuition?: number | null;
  avgSalary?: number | null;
}

export interface RankingStats {
  usNewsRank: { min: number; max: number };
  acceptanceRate: { min: number; max: number };
  tuition: { min: number; max: number };
  avgSalary: { min: number; max: number };
}

function toFiniteNumber(value: number | Prisma.Decimal | null | undefined) {
  if (value == null) return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function safeMinMax(values: number[]) {
  return {
    min: values.length > 0 ? Math.min(...values) : 0,
    max: values.length > 0 ? Math.max(...values) : 0,
  };
}

export function sanitizeRankingWeights(
  weights: Partial<RankingWeights>,
): RankingWeights {
  return {
    usNewsRank: Number(weights.usNewsRank) || 0,
    acceptanceRate: Number(weights.acceptanceRate) || 0,
    tuition: Number(weights.tuition) || 0,
    avgSalary: Number(weights.avgSalary) || 0,
  };
}

export function normalizeRankingWeights(
  weights: Partial<RankingWeights>,
): RankingWeights {
  const validWeights = sanitizeRankingWeights(weights);
  const totalWeight = Object.values(validWeights).reduce(
    (sum, weight) => sum + weight,
    0,
  );

  if (totalWeight === 0) {
    return validWeights;
  }

  return {
    usNewsRank: (validWeights.usNewsRank / totalWeight) * 100,
    acceptanceRate: (validWeights.acceptanceRate / totalWeight) * 100,
    tuition: (validWeights.tuition / totalWeight) * 100,
    avgSalary: (validWeights.avgSalary / totalWeight) * 100,
  };
}

export function calculateRankingStats<T extends RankingScoreInput>(
  schools: T[],
): RankingStats {
  return {
    usNewsRank: safeMinMax(
      schools
        .map((school) => toFiniteNumber(school.usNewsRank))
        .filter((v): v is number => v != null),
    ),
    acceptanceRate: safeMinMax(
      schools
        .map((school) => toFiniteNumber(school.acceptanceRate))
        .filter((v): v is number => v != null),
    ),
    tuition: safeMinMax(
      schools
        .map((school) => toFiniteNumber(school.tuition))
        .filter((v): v is number => v != null),
    ),
    avgSalary: safeMinMax(
      schools
        .map((school) => toFiniteNumber(school.avgSalary))
        .filter((v): v is number => v != null),
    ),
  };
}

export function calculateSchoolScore<T extends RankingScoreInput>(
  school: T,
  weights: RankingWeights,
  stats: RankingStats,
): number {
  let score = 0;
  const rank = toFiniteNumber(school.usNewsRank);
  const acceptanceRate = toFiniteNumber(school.acceptanceRate);
  const tuition = toFiniteNumber(school.tuition);
  const avgSalary = toFiniteNumber(school.avgSalary);

  if (rank !== null) {
    const normalized =
      1 -
      (rank - stats.usNewsRank.min) /
        (stats.usNewsRank.max - stats.usNewsRank.min || 1);
    score += normalized * weights.usNewsRank;
  }

  if (acceptanceRate !== null) {
    const normalized =
      1 -
      (acceptanceRate - stats.acceptanceRate.min) /
        (stats.acceptanceRate.max - stats.acceptanceRate.min || 1);
    score += normalized * weights.acceptanceRate;
  }

  if (tuition !== null) {
    const normalized =
      1 -
      (tuition - stats.tuition.min) /
        (stats.tuition.max - stats.tuition.min || 1);
    score += normalized * weights.tuition;
  }

  if (avgSalary !== null) {
    const normalized =
      (avgSalary - stats.avgSalary.min) /
      (stats.avgSalary.max - stats.avgSalary.min || 1);
    score += normalized * weights.avgSalary;
  }

  return score;
}

export function scoreAndRankSchools<T extends RankingScoreInput>(
  schools: T[],
  weights: Partial<RankingWeights>,
): Array<T & { score: number; rank: number }> {
  const normalizedWeights = normalizeRankingWeights(weights);
  const stats = calculateRankingStats(schools);
  const scoredSchools = schools.map((school) => ({
    ...school,
    score: calculateSchoolScore(school, normalizedWeights, stats),
    rank: 0,
  }));
  const maxScore =
    scoredSchools.length > 0
      ? Math.max(...scoredSchools.map((s) => s.score))
      : 0;

  if (maxScore > 0) {
    scoredSchools.forEach((school) => {
      school.score = (school.score / maxScore) * 100;
    });
  }

  scoredSchools.sort((a, b) => b.score - a.score);
  scoredSchools.forEach((school, index) => {
    school.rank = index + 1;
  });

  return scoredSchools;
}
