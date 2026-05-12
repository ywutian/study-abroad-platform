import { Injectable, Logger } from '@nestjs/common';
import { DataReviewStatus, Prisma, School } from '@prisma/client';
import {
  resolveSchoolTestingPolicyValue,
  serializeSchoolProvenance,
  toLegacyTestOptionalFlag,
} from '@study-abroad/shared/utils';
import type { SchoolProvenance } from '@study-abroad/shared';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeSchoolName } from '../../common/utils/school-name.util';
import { deepMergeRecords, toRecord } from './school-provenance.helpers';

const LIST_CACHE_INVALIDATION_MIN_INTERVAL_MS = 60_000;

type SchoolWriterClient =
  | Pick<PrismaService, 'school'>
  | Prisma.TransactionClient;

export interface SchoolWriteParams {
  fields?: Record<string, unknown>;
  metadataPatch?: Record<string, unknown>;
  provenance?: SchoolProvenance;
  reviewStatus?: DataReviewStatus;
  touchReviewTimestamp?: boolean;
  existingMetadata?: unknown;
}

function buildSchoolWriteData(
  existingMetadata: unknown,
  params: SchoolWriteParams,
): Prisma.SchoolUpdateInput {
  const nextData = { ...(params.fields ?? {}) } as Record<string, unknown>;

  if (typeof nextData.name === 'string' && !nextData.nameNorm) {
    nextData.nameNorm = normalizeSchoolName(nextData.name);
  }

  const nextTestingPolicy = resolveSchoolTestingPolicyValue({
    testingPolicy: nextData.testingPolicy as any,
    testOptional:
      typeof nextData.testOptional === 'boolean'
        ? nextData.testOptional
        : undefined,
  });
  if (
    nextData.testingPolicy !== undefined ||
    nextData.testOptional !== undefined
  ) {
    nextData.testingPolicy = nextTestingPolicy;
    nextData.testOptional = toLegacyTestOptionalFlag({
      testingPolicy: nextTestingPolicy,
      testOptional:
        typeof nextData.testOptional === 'boolean'
          ? nextData.testOptional
          : undefined,
    });
  }

  const metadataPatch = params.metadataPatch ?? {};
  const provenance = params.provenance ?? {};
  if (
    Object.keys(metadataPatch).length > 0 ||
    Object.keys(provenance).length > 0
  ) {
    const nextMetadata = deepMergeRecords(
      toRecord(existingMetadata),
      metadataPatch,
    );
    const storedProvenance = serializeSchoolProvenance(provenance);

    if (Object.keys(storedProvenance).length > 0) {
      nextMetadata.provenance = deepMergeRecords(
        toRecord(nextMetadata.provenance),
        storedProvenance,
      );
    }

    nextData.metadata = nextMetadata;
  }

  if (params.reviewStatus) {
    nextData.dataReviewStatus = params.reviewStatus;
  }
  if (params.touchReviewTimestamp) {
    nextData.lastDataReviewAt = new Date();
  }

  return nextData;
}

export async function writeSchoolCreate(
  client: SchoolWriterClient,
  params: SchoolWriteParams & { fields: Record<string, unknown> },
): Promise<School> {
  const data = buildSchoolWriteData({}, params) as Prisma.SchoolCreateInput;
  return client.school.create({
    data,
  });
}

export async function writeSchoolUpdate(
  client: SchoolWriterClient,
  schoolId: string,
  params: SchoolWriteParams,
): Promise<School> {
  const existingMetadata =
    params.existingMetadata ??
    (
      await client.school.findUnique({
        where: { id: schoolId },
        select: { metadata: true },
      })
    )?.metadata ??
    {};

  const data = buildSchoolWriteData(existingMetadata, params);
  return client.school.update({
    where: { id: schoolId },
    data,
  });
}

@Injectable()
export class SchoolWriteService {
  private readonly logger = new Logger(SchoolWriteService.name);
  private lastListCacheInvalidatedAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(
    params: SchoolWriteParams & { fields: Record<string, unknown> },
  ): Promise<School> {
    const school = await writeSchoolCreate(this.prisma, params);
    await this.invalidateSchoolCaches(school.id);
    return school;
  }

  async update(schoolId: string, params: SchoolWriteParams): Promise<School> {
    const school = await writeSchoolUpdate(this.prisma, schoolId, params);
    await this.invalidateSchoolCaches(schoolId);
    return school;
  }

  async invalidateSchoolCaches(schoolId?: string): Promise<void> {
    try {
      const now = Date.now();
      const shouldInvalidateListCache =
        now - this.lastListCacheInvalidatedAt >=
        LIST_CACHE_INVALIDATION_MIN_INTERVAL_MS;
      if (shouldInvalidateListCache) {
        this.lastListCacheInvalidatedAt = now;
      }

      await Promise.all([
        schoolId
          ? this.redis.del(`school:detail:${schoolId}`)
          : Promise.resolve(0),
        shouldInvalidateListCache
          ? this.redis.delByPrefix('school:list:')
          : Promise.resolve(0),
        this.redis.del('school:data-quality'),
      ]);
    } catch (error) {
      this.logger.warn(`Failed to invalidate school caches: ${String(error)}`);
    }
  }
}
