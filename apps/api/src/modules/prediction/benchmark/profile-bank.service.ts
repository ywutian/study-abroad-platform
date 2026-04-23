import { Injectable } from '@nestjs/common';
import type { BenchmarkProfileInput } from '@study-abroad/shared';
import { PrismaService } from '../../../prisma/prisma.service';

type TestRegime = 'SAT' | 'ACT' | 'TEST_OPTIONAL';
type MajorBucket =
  | 'Computer Science'
  | 'Biology'
  | 'Business Administration'
  | 'Psychology'
  | 'English Literature'
  | 'Mechanical Engineering';

type NationalityBucket = 'US' | 'CN' | 'IN' | 'KR' | 'SG';

export type ProfileBankRow = {
  label: string;
  cohortTag: string;
  profileJson: BenchmarkProfileInput;
};

export type GenerateProfileBankInput = {
  count: number;
  seed?: number;
  cohortTag?: string;
  labelPrefix?: string;
};

export type SyncProfileBankResult = {
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
  profiles: ProfileBankRow[];
};

const DEFAULT_COHORT_TAG = 'distill-corpus-v1';
const DEFAULT_LABEL_PREFIX = 'distill';

const MAJOR_BUCKETS: MajorBucket[] = [
  'Computer Science',
  'Biology',
  'Business Administration',
  'Psychology',
  'English Literature',
  'Mechanical Engineering',
];

const NATIONALITY_BUCKETS: NationalityBucket[] = ['US', 'CN', 'IN', 'KR', 'SG'];

const ACTIVITY_CATEGORY_BY_MAJOR: Record<MajorBucket, string[]> = {
  'Computer Science': ['RESEARCH', 'LEADERSHIP', 'CLUB', 'ACADEMIC'],
  Biology: ['RESEARCH', 'COMMUNITY_SERVICE', 'ACADEMIC', 'LEADERSHIP'],
  'Business Administration': [
    'LEADERSHIP',
    'WORK',
    'COMMUNITY_SERVICE',
    'CLUB',
  ],
  Psychology: ['COMMUNITY_SERVICE', 'RESEARCH', 'LEADERSHIP', 'ACADEMIC'],
  'English Literature': ['ARTS', 'HOBBY', 'LEADERSHIP', 'COMMUNITY_SERVICE'],
  'Mechanical Engineering': [
    'RESEARCH',
    'INTERNSHIP',
    'ACADEMIC',
    'LEADERSHIP',
  ],
};

const AWARD_LEVELS = [
  'SCHOOL',
  'REGIONAL',
  'STATE',
  'NATIONAL',
  'INTERNATIONAL',
] as const;

class SeededRandom {
  constructor(private state: number) {}

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shuffle<T>(values: T[], rng: SeededRandom): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function lhsContinuous(
  count: number,
  min: number,
  max: number,
  rng: SeededRandom,
  precision = 2,
): number[] {
  const values = Array.from({ length: count }, (_, index) => {
    const fraction = (index + 0.5) / count;
    const scaled = min + fraction * (max - min);
    return Number(scaled.toFixed(precision));
  });
  return shuffle(values, rng);
}

function lhsInteger(
  count: number,
  min: number,
  max: number,
  rng: SeededRandom,
): number[] {
  const values = lhsContinuous(count, min, max, rng, 6).map((value) =>
    clamp(Math.round(value), min, max),
  );
  return shuffle(values, rng);
}

function balancedCategories<T>(
  count: number,
  values: readonly T[],
  rng: SeededRandom,
): T[] {
  const out = Array.from(
    { length: count },
    (_, index) => values[index % values.length],
  );
  return shuffle(out, rng);
}

function distributedBooleans(
  count: number,
  trueRatio: number,
  rng: SeededRandom,
): boolean[] {
  const trueCount = Math.round(count * trueRatio);
  const out = Array.from({ length: count }, (_, index) => index < trueCount);
  return shuffle(out, rng);
}

function inferHighSchoolType(
  nationality: NationalityBucket,
  highSchoolTier: number,
): string {
  if (nationality === 'US') {
    return highSchoolTier <= 2 ? 'PRIVATE_US' : 'PUBLIC_US';
  }
  if (nationality === 'CN') {
    return highSchoolTier <= 3 ? 'INTL_CN' : 'PUBLIC_CN';
  }
  return 'INTL_OTHER';
}

function inferEducationSystem(nationality: NationalityBucket): string {
  switch (nationality) {
    case 'US':
      return 'AP';
    case 'CN':
      return 'IB';
    case 'IN':
      return 'A_LEVEL';
    case 'KR':
      return 'OTHER';
    default:
      return 'CANADIAN';
  }
}

function createActivities(
  count: number,
  major: MajorBucket,
  rng: SeededRandom,
): BenchmarkProfileInput['activities'] {
  const categories = ACTIVITY_CATEGORY_BY_MAJOR[major];
  return Array.from({ length: count }, (_, index) => {
    const category = categories[index % categories.length] ?? 'OTHER';
    return {
      name: `${major} Activity ${index + 1}`,
      category,
      role: index === 0 ? 'Founder' : index === 1 ? 'Lead' : 'Member',
      description: `${major} oriented extracurricular ${index + 1}`,
      hoursPerWeek: clamp(3 + Math.round(rng.next() * 9), 2, 12),
      weeksPerYear: clamp(12 + Math.round(rng.next() * 28), 10, 40),
    };
  });
}

function createAwards(
  count: number,
  major: MajorBucket,
  highSchoolTier: number,
  rng: SeededRandom,
): BenchmarkProfileInput['awards'] {
  return Array.from({ length: count }, (_, index) => {
    const levelIndex = clamp(
      Math.round((highSchoolTier - 1 + index + rng.next()) / 2),
      0,
      AWARD_LEVELS.length - 1,
    );
    return {
      level: AWARD_LEVELS[levelIndex],
      name: `${major} Award ${index + 1}`,
      competitionName:
        levelIndex >= 3 ? `${major} Competition` : `${major} Showcase`,
      tier: levelIndex >= 3 ? levelIndex + 1 : undefined,
    };
  });
}

function createTestScores(
  regime: TestRegime,
  satScore: number,
  actScore: number,
  nationality: NationalityBucket,
): BenchmarkProfileInput['testScores'] {
  const scores: BenchmarkProfileInput['testScores'] = [];

  if (regime === 'SAT') {
    scores.push({ type: 'SAT', score: satScore });
  }

  if (regime === 'ACT') {
    scores.push({ type: 'ACT', score: actScore });
  }

  if (nationality !== 'US') {
    scores.push({
      type: 'TOEFL',
      score: clamp(95 + Math.round(satScore / 40), 95, 118),
    });
  }

  return scores;
}

@Injectable()
export class ProfileBankService {
  constructor(private readonly prisma: PrismaService) {}

  generateProfiles(input: GenerateProfileBankInput): ProfileBankRow[] {
    const count = Math.max(1, Math.floor(input.count));
    const seed = input.seed ?? 20260422;
    const cohortTag = input.cohortTag ?? DEFAULT_COHORT_TAG;
    const labelPrefix = input.labelPrefix ?? DEFAULT_LABEL_PREFIX;
    const rng = new SeededRandom(seed);

    const gpas = lhsContinuous(count, 2.5, 4.0, rng, 4);
    const satScores = lhsInteger(count, 1000, 1600, rng);
    const actScores = lhsInteger(count, 20, 36, rng);
    const activityCounts = lhsInteger(count, 0, 10, rng);
    const awardCounts = lhsInteger(count, 0, 5, rng);
    const highSchoolTiers = lhsInteger(count, 1, 5, rng);
    const regimes = balancedCategories<TestRegime>(
      count,
      ['SAT', 'ACT', 'TEST_OPTIONAL'],
      rng,
    );
    const majors = balancedCategories(count, MAJOR_BUCKETS, rng);
    const nationalities = balancedCategories(count, NATIONALITY_BUCKETS, rng);
    const firstGenFlags = distributedBooleans(count, 0.25, rng);
    const legacyFlags = distributedBooleans(count, 0.15, rng);

    return Array.from({ length: count }, (_, index) => {
      const major = majors[index];
      const nationality = nationalities[index];
      const highSchoolTier = highSchoolTiers[index];
      const regime = regimes[index];
      const profileJson: BenchmarkProfileInput = {
        gpa: gpas[index],
        gpaScale: 4.0,
        targetMajor: major,
        isInternational: nationality !== 'US',
        nationality,
        educationSystem: inferEducationSystem(nationality),
        currentSchoolType: inferHighSchoolType(nationality, highSchoolTier),
        highSchoolTier,
        highSchoolType: inferHighSchoolType(nationality, highSchoolTier),
        needsFinancialAid: firstGenFlags[index] ?? false,
        isFirstGen: firstGenFlags[index] ?? false,
        isLegacy: legacyFlags[index] ?? false,
        legacySchools: legacyFlags[index] ? ['Legacy University'] : [],
        applicationRound: 'RD',
        locale: 'en',
        testScores: createTestScores(
          regime,
          satScores[index],
          actScores[index],
          nationality,
        ),
        activities: createActivities(activityCounts[index], major, rng),
        awards: createAwards(awardCounts[index], major, highSchoolTier, rng),
      };

      return {
        label: `${labelPrefix}-${String(index + 1).padStart(3, '0')}`,
        cohortTag,
        profileJson,
      };
    });
  }

  async syncProfiles(
    input: GenerateProfileBankInput,
  ): Promise<SyncProfileBankResult> {
    const profiles = this.generateProfiles(input);
    const cohortTag =
      profiles[0]?.cohortTag ?? input.cohortTag ?? DEFAULT_COHORT_TAG;

    const existing = await this.prisma.benchmarkProfile.findMany({
      where: { cohortTag },
      select: { id: true, label: true },
    });

    const existingByLabel = new Map(existing.map((row) => [row.label, row]));
    const nextLabels = new Set(profiles.map((row) => row.label));

    let createdCount = 0;
    let updatedCount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const profile of profiles) {
        const existingRow = existingByLabel.get(profile.label);
        if (existingRow) {
          updatedCount += 1;
          await tx.benchmarkProfile.update({
            where: { id: existingRow.id },
            data: {
              cohortTag: profile.cohortTag,
              profileJson: profile.profileJson as never,
            },
          });
        } else {
          createdCount += 1;
          await tx.benchmarkProfile.create({
            data: {
              label: profile.label,
              cohortTag: profile.cohortTag,
              profileJson: profile.profileJson as never,
            },
          });
        }
      }

      const staleIds = existing
        .filter((row) => !nextLabels.has(row.label))
        .map((row) => row.id);

      if (staleIds.length > 0) {
        await tx.benchmarkProfile.deleteMany({
          where: { id: { in: staleIds } },
        });
      }
    });

    const deletedCount = existing.filter(
      (row) => !nextLabels.has(row.label),
    ).length;

    return {
      createdCount,
      updatedCount,
      deletedCount,
      profiles,
    };
  }
}
