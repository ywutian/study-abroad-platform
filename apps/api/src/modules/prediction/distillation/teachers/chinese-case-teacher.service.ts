import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CASE_REVIEW_APPROVED_WHERE } from '../../../../common/constants/prisma-selects';
import type { TeacherSignalProvider } from '../types';
import type {
  DistillationEvaluationInput,
  DistillationTeacherSignal,
} from '../types';

const DEFAULT_WEIGHT = 0.12;
const CHINA_CODES = ['CN', 'CHN', 'CHINA', 'PRC', 'CHINESE', 'CHINA_MAINLAND'];
const HIGH_SCHOOL_TYPE_ALIASES: Record<string, string> = {
  INTERNATIONAL: 'INTL_CN',
  INTL: 'INTL_CN',
  INTL_CN: 'INTL_CN',
  PUBLIC: 'PUBLIC_US',
  PUBLIC_US: 'PUBLIC_US',
  PUBLIC_CN: 'PUBLIC_CN',
  PRIVATE: 'PRIVATE_US',
  PRIVATE_US: 'PRIVATE_US',
  PRIVATE_CN: 'PRIVATE_CN',
  BOARDING: 'BOARDING_US',
  BOARDING_US: 'BOARDING_US',
  INTL_OTHER: 'INTL_OTHER',
  PUBLIC_OTHER: 'PUBLIC_OTHER',
  PRIVATE_OTHER: 'PRIVATE_OTHER',
};

function clampProbability(value: number): number {
  return Math.max(0.01, Math.min(0.99, value));
}

function normalizeHighSchoolType(value?: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.toUpperCase().replace(/\s+/g, '_');
  return HIGH_SCHOOL_TYPE_ALIASES[normalized];
}

type CaseBucket = {
  key: string;
  where: Record<string, any>;
};

@Injectable()
export class ChineseCaseTeacherService implements TeacherSignalProvider {
  readonly key = 'cn-case-v1' as const;
  readonly label = 'Chinese Case Teacher';
  readonly sourceType = 'INTERNAL_CASES' as const;
  readonly defaultWeight = DEFAULT_WEIGHT;

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    input: DistillationEvaluationInput,
  ): Promise<
    Omit<DistillationTeacherSignal, 'configuredWeight' | 'effectiveBlendWeight'>
  > {
    if (!input.cohortKey.startsWith('CN__')) {
      return {
        key: this.key,
        label: this.label,
        sourceName: 'distillation:cn-case-v1',
        sourceType: this.sourceType,
        probability: null,
        active: false,
        confidence: 'low',
        missingReasons: ['non_china_cohort'],
      };
    }

    const buckets = this.buildBuckets(input);

    for (const bucket of buckets) {
      const grouped = await this.prisma.admissionCase.groupBy({
        by: ['result'],
        where: {
          schoolId: input.schoolId,
          isVerified: true,
          ...CASE_REVIEW_APPROVED_WHERE,
          ...bucket.where,
        },
        _count: true,
      });

      const total = grouped.reduce((sum: number, row) => sum + row._count, 0);
      if (total < 10) continue;

      const admitted =
        grouped.find((row) => row.result === 'ADMITTED')?._count ?? 0;
      const confidence = total >= 20 ? 'medium' : 'low';

      return {
        key: this.key,
        label: this.label,
        sourceName: 'distillation:cn-case-v1',
        sourceType: this.sourceType,
        probability: clampProbability(admitted / total),
        active: true,
        confidence,
        sampleCount: total,
        bucketKey: bucket.key,
        missingReasons: [],
        metadata: {
          admitted,
          total,
          bucketKey: bucket.key,
        },
      };
    }

    return {
      key: this.key,
      label: this.label,
      sourceName: 'distillation:cn-case-v1',
      sourceType: this.sourceType,
      probability: null,
      active: false,
      confidence: 'low',
      missingReasons: ['insufficient_chinese_cases'],
    };
  }

  private buildBuckets(input: DistillationEvaluationInput): CaseBucket[] {
    const curriculumType = input.profile.educationSystem ?? undefined;
    const highSchoolType = normalizeHighSchoolType(
      input.profile.highSchoolType ??
        input.profile.currentSchoolType ??
        undefined,
    );
    const round = input.applicationRound || undefined;

    const buckets: CaseBucket[] = [];

    if (curriculumType && highSchoolType && round) {
      buckets.push({
        key: 'school:nationality:curriculum:hs:round',
        where: {
          nationality: { in: CHINA_CODES },
          curriculumType,
          highSchoolType,
          round,
        },
      });
    }
    if (curriculumType && highSchoolType) {
      buckets.push({
        key: 'school:nationality:curriculum:hs',
        where: {
          nationality: { in: CHINA_CODES },
          curriculumType,
          highSchoolType,
        },
      });
    }
    buckets.push({
      key: 'school:nationality',
      where: { nationality: { in: CHINA_CODES } },
    });
    if (curriculumType) {
      buckets.push({
        key: 'school:intl:curriculum',
        where: {
          demographicTags: { has: 'international' },
          curriculumType,
        },
      });
    }
    buckets.push({
      key: 'school:intl',
      where: {
        demographicTags: { has: 'international' },
      },
    });

    return buckets;
  }
}
