import { Prisma } from '@prisma/client';
import { nicheGradeToScore } from '@study-abroad/shared/scoring';
import {
  getCatalogRankSortValue,
  type CatalogRanking,
  type RankingListSelection,
} from '../school/school-ranking-catalog';

export interface RankingWeights {
  usNewsRank: number;
  acceptanceRate: number;
  tuition: number;
  avgSalary: number;
  // Niche qualitative fit signals (each 0-100 weight, optional). They affect
  // ranking only — never admission probability.
  nicheOverall: number;
  safetyGrade: number;
  studentLifeGrade: number;
  campusFoodGrade: number;
}

export interface RankingScoreInput {
  name?: string | null;
  usNewsRank?: number | null;
  institutionType?: string | null;
  rankings?: CatalogRanking[] | null;
  acceptanceRate?: number | Prisma.Decimal | null;
  tuition?: number | null;
  avgSalary?: number | null;
  nicheOverallGrade?: string | null;
  nicheSafetyGrade?: string | null;
  nicheLifeGrade?: string | null;
  nicheFoodGrade?: string | null;
}

export interface RankingScoreOptions {
  rankingList?: RankingListSelection;
}

export interface RankingStats {
  usNewsRank: { min: number; max: number };
  acceptanceRate: { min: number; max: number };
  tuition: { min: number; max: number };
  avgSalary: { min: number; max: number };
  nicheOverall: { min: number; max: number };
  safetyGrade: { min: number; max: number };
  studentLifeGrade: { min: number; max: number };
  campusFoodGrade: { min: number; max: number };
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

const ALL_WEIGHT_KEYS: (keyof RankingWeights)[] = [
  'usNewsRank',
  'acceptanceRate',
  'tuition',
  'avgSalary',
  'nicheOverall',
  'safetyGrade',
  'studentLifeGrade',
  'campusFoodGrade',
];

export function sanitizeRankingWeights(
  weights: Partial<RankingWeights>,
): RankingWeights {
  return {
    usNewsRank: Number(weights.usNewsRank) || 0,
    acceptanceRate: Number(weights.acceptanceRate) || 0,
    tuition: Number(weights.tuition) || 0,
    avgSalary: Number(weights.avgSalary) || 0,
    nicheOverall: Number(weights.nicheOverall) || 0,
    safetyGrade: Number(weights.safetyGrade) || 0,
    studentLifeGrade: Number(weights.studentLifeGrade) || 0,
    campusFoodGrade: Number(weights.campusFoodGrade) || 0,
  };
}

export function normalizeRankingWeights(
  weights: Partial<RankingWeights>,
): RankingWeights {
  const validWeights = sanitizeRankingWeights(weights);
  const totalWeight = ALL_WEIGHT_KEYS.reduce(
    (sum, key) => sum + validWeights[key],
    0,
  );

  if (totalWeight === 0) {
    return validWeights;
  }

  const normalized = {} as RankingWeights;
  for (const key of ALL_WEIGHT_KEYS) {
    normalized[key] = (validWeights[key] / totalWeight) * 100;
  }
  return normalized;
}

export function calculateRankingStats<T extends RankingScoreInput>(
  schools: T[],
  options: RankingScoreOptions = {},
): RankingStats {
  const numericValues = (extract: (s: T) => number | null) =>
    schools.map(extract).filter((v): v is number => v != null);

  return {
    usNewsRank: safeMinMax(
      numericValues((school) =>
        toFiniteNumber(getComparableRank(school, options.rankingList)),
      ),
    ),
    acceptanceRate: safeMinMax(
      numericValues((school) => toFiniteNumber(school.acceptanceRate)),
    ),
    tuition: safeMinMax(
      numericValues((school) => toFiniteNumber(school.tuition)),
    ),
    avgSalary: safeMinMax(
      numericValues((school) => toFiniteNumber(school.avgSalary)),
    ),
    // Niche grade scores are already normalized to [0, 1] by nicheGradeToScore;
    // we keep min/max so calculateSchoolScore uses the same code path as the
    // numeric dimensions. With a [0, 1] domain the normalization is a no-op
    // when min=0 / max=1.
    nicheOverall: safeMinMax(
      numericValues((school) => nicheGradeToScore(school.nicheOverallGrade)),
    ),
    safetyGrade: safeMinMax(
      numericValues((school) => nicheGradeToScore(school.nicheSafetyGrade)),
    ),
    studentLifeGrade: safeMinMax(
      numericValues((school) => nicheGradeToScore(school.nicheLifeGrade)),
    ),
    campusFoodGrade: safeMinMax(
      numericValues((school) => nicheGradeToScore(school.nicheFoodGrade)),
    ),
  };
}

export function calculateSchoolScore<T extends RankingScoreInput>(
  school: T,
  weights: RankingWeights,
  stats: RankingStats,
  options: RankingScoreOptions = {},
): number {
  let score = 0;
  const rank = getComparableRank(school, options.rankingList);
  const acceptanceRate = toFiniteNumber(school.acceptanceRate);
  const tuition = toFiniteNumber(school.tuition);
  const avgSalary = toFiniteNumber(school.avgSalary);
  const nicheOverall = nicheGradeToScore(school.nicheOverallGrade);
  const safety = nicheGradeToScore(school.nicheSafetyGrade);
  const life = nicheGradeToScore(school.nicheLifeGrade);
  const food = nicheGradeToScore(school.nicheFoodGrade);

  // For "lower is better" dimensions, invert: 1 - normalized
  // For "higher is better" dimensions, use raw normalized value
  const normalizeAsc = (
    value: number,
    s: { min: number; max: number },
  ): number => (value - s.min) / (s.max - s.min || 1);
  const normalizeDesc = (
    value: number,
    s: { min: number; max: number },
  ): number => 1 - normalizeAsc(value, s);

  if (rank !== null) {
    score += normalizeDesc(rank, stats.usNewsRank) * weights.usNewsRank;
  }
  if (acceptanceRate !== null) {
    score +=
      normalizeDesc(acceptanceRate, stats.acceptanceRate) *
      weights.acceptanceRate;
  }
  if (tuition !== null) {
    score += normalizeDesc(tuition, stats.tuition) * weights.tuition;
  }
  if (avgSalary !== null) {
    score += normalizeAsc(avgSalary, stats.avgSalary) * weights.avgSalary;
  }
  if (nicheOverall !== null) {
    score +=
      normalizeAsc(nicheOverall, stats.nicheOverall) * weights.nicheOverall;
  }
  if (safety !== null) {
    score += normalizeAsc(safety, stats.safetyGrade) * weights.safetyGrade;
  }
  if (life !== null) {
    score +=
      normalizeAsc(life, stats.studentLifeGrade) * weights.studentLifeGrade;
  }
  if (food !== null) {
    score +=
      normalizeAsc(food, stats.campusFoodGrade) * weights.campusFoodGrade;
  }

  return score;
}

function getComparableRank<T extends RankingScoreInput>(
  school: T,
  rankingList?: RankingListSelection,
): number | null {
  if (school.name) {
    return getCatalogRankSortValue(
      {
        name: school.name,
        usNewsRank: school.usNewsRank,
        institutionType: school.institutionType,
        rankings: school.rankings,
      },
      rankingList,
    );
  }
  return toFiniteNumber(school.usNewsRank);
}

export function scoreAndRankSchools<T extends RankingScoreInput>(
  schools: T[],
  weights: Partial<RankingWeights>,
  options: RankingScoreOptions = {},
): Array<T & { score: number; rank: number }> {
  const normalizedWeights = normalizeRankingWeights(weights);
  const stats = calculateRankingStats(schools, options);
  const scoredSchools = schools.map((school) => ({
    ...school,
    score: calculateSchoolScore(school, normalizedWeights, stats, options),
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
