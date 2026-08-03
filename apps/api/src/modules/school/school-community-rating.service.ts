import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { SchoolCommunityRatingSummary } from '@study-abroad/shared';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  AuditAction,
  AuditLogService,
} from '../../common/services/audit-log.service';
import { UpdateSchoolCommunityRatingDto } from './dto/update-school-community-rating.dto';

const MIN_PUBLIC_RATING_COUNT = 5;

type RatingAggregate = {
  _count: { _all: number };
  _avg: {
    safetyRating: number | null;
    lifeRating: number | null;
    foodRating: number | null;
  };
};

@Injectable()
export class SchoolCommunityRatingService {
  private readonly logger = new Logger(SchoolCommunityRatingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly auditLogService: AuditLogService,
  ) {}

  static get minPublicRatingCount(): number {
    return MIN_PUBLIC_RATING_COUNT;
  }

  private get ratingModel() {
    return (this.prisma as PrismaClient).schoolCommunityRating;
  }

  private isMissingRatingTableError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2021'
    );
  }

  private createEmptySummaryMap(
    schoolIds: string[],
  ): Record<string, SchoolCommunityRatingSummary> {
    return Object.fromEntries(
      schoolIds.map((schoolId) => [schoolId, this.createEmptySummary()]),
    );
  }

  async getSummariesForSchools(
    schoolIds: string[],
  ): Promise<Record<string, SchoolCommunityRatingSummary>> {
    const uniqueSchoolIds = [...new Set(schoolIds.filter(Boolean))];
    if (uniqueSchoolIds.length === 0) {
      return {};
    }

    let grouped: Array<{ schoolId: string } & RatingAggregate>;
    try {
      const groupedResult = await this.ratingModel.groupBy({
        by: ['schoolId'],
        where: {
          schoolId: { in: uniqueSchoolIds },
          isHidden: false,
        },
        _count: { _all: true },
        _avg: {
          safetyRating: true,
          lifeRating: true,
          foodRating: true,
        },
      });
      grouped = groupedResult;
    } catch (error) {
      if (this.isMissingRatingTableError(error)) {
        this.logger.warn(
          'SchoolCommunityRating table is missing; returning empty community summaries',
        );
        return this.createEmptySummaryMap(uniqueSchoolIds);
      }
      throw error;
    }

    const summaries = this.createEmptySummaryMap(uniqueSchoolIds);

    for (const row of grouped) {
      summaries[row.schoolId] = this.toPublicSummary(row);
    }

    return summaries;
  }

  async getSummary(schoolId: string): Promise<SchoolCommunityRatingSummary> {
    await this.ensureSchoolExists(schoolId);
    const summaries = await this.getSummariesForSchools([schoolId]);
    return summaries[schoolId] ?? this.createEmptySummary();
  }

  async getMyRating(schoolId: string, userId: string) {
    await this.ensureSchoolExists(schoolId);
    try {
      return await this.ratingModel.findUnique({
        where: {
          schoolId_userId: {
            schoolId,
            userId,
          },
        },
        select: {
          id: true,
          schoolId: true,
          userId: true,
          safetyRating: true,
          lifeRating: true,
          foodRating: true,
          isHidden: true,
          hiddenReason: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (this.isMissingRatingTableError(error)) {
        this.logger.warn(
          'SchoolCommunityRating table is missing; getMyRating returned null',
        );
        return null;
      }
      throw error;
    }
  }

  async upsertMyRating(
    schoolId: string,
    userId: string,
    dto: UpdateSchoolCommunityRatingDto,
  ) {
    await this.ensureSchoolExists(schoolId);

    const rating = await this.ratingModel.upsert({
      where: {
        schoolId_userId: {
          schoolId,
          userId,
        },
      },
      create: {
        schoolId,
        userId,
        safetyRating: dto.safetyRating,
        lifeRating: dto.lifeRating,
        foodRating: dto.foodRating,
      },
      update: {
        safetyRating: dto.safetyRating,
        lifeRating: dto.lifeRating,
        foodRating: dto.foodRating,
      },
      select: {
        id: true,
        schoolId: true,
        userId: true,
        safetyRating: true,
        lifeRating: true,
        foodRating: true,
        isHidden: true,
        hiddenReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.invalidateSchoolCaches(schoolId);

    return {
      ...rating,
      summary: await this.getSummary(schoolId),
    };
  }

  async getAdminRatings(schoolId: string) {
    await this.ensureSchoolExists(schoolId);

    const [visibleAggregate, totalCount, hiddenCount, ratings] =
      await Promise.all([
        this.ratingModel.aggregate({
          where: { schoolId, isHidden: false },
          _count: { _all: true },
          _avg: {
            safetyRating: true,
            lifeRating: true,
            foodRating: true,
          },
        }),
        this.ratingModel.count({
          where: { schoolId },
        }),
        this.ratingModel.count({
          where: { schoolId, isHidden: true },
        }),
        this.ratingModel.findMany({
          where: { schoolId },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            schoolId: true,
            userId: true,
            safetyRating: true,
            lifeRating: true,
            foodRating: true,
            isHidden: true,
            hiddenAt: true,
            hiddenBy: true,
            hiddenReason: true,
            createdAt: true,
            updatedAt: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        }),
      ]);

    const visibleCount = visibleAggregate._count._all;

    return {
      schoolId,
      threshold: MIN_PUBLIC_RATING_COUNT,
      totalCount,
      hiddenCount,
      visibleCount,
      publicSummary: this.toPublicSummary(visibleAggregate),
      visibleSummary: {
        count: visibleCount,
        safetyAvg: this.roundAverage(visibleAggregate._avg.safetyRating),
        lifeAvg: this.roundAverage(visibleAggregate._avg.lifeRating),
        foodAvg: this.roundAverage(visibleAggregate._avg.foodRating),
      },
      ratings,
    };
  }

  async hideRating(ratingId: string, adminUserId: string, reason?: string) {
    const existing = await this.ratingModel.findUnique({
      where: { id: ratingId },
      select: { id: true, schoolId: true, isHidden: true },
    });

    if (!existing) {
      throw new NotFoundException('Community rating not found');
    }

    const rating = existing.isHidden
      ? await this.ratingModel.findUnique({
          where: { id: ratingId },
          select: {
            id: true,
            schoolId: true,
            isHidden: true,
            hiddenAt: true,
            hiddenBy: true,
            hiddenReason: true,
          },
        })
      : await this.ratingModel.update({
          where: { id: ratingId },
          data: {
            isHidden: true,
            hiddenAt: new Date(),
            hiddenBy: adminUserId,
            hiddenReason: reason?.trim() || null,
          },
          select: {
            id: true,
            schoolId: true,
            isHidden: true,
            hiddenAt: true,
            hiddenBy: true,
            hiddenReason: true,
          },
        });

    await this.invalidateSchoolCaches(existing.schoolId);
    await this.auditLogService.log({
      userId: adminUserId,
      action: AuditAction.ADMIN_ACTION,
      resource: 'school-community-ratings',
      resourceId: ratingId,
      metadata: {
        action: 'hide',
        schoolId: existing.schoolId,
        reason: reason?.trim() || null,
      },
    });

    return rating;
  }

  async restoreRating(ratingId: string, adminUserId: string) {
    const existing = await this.ratingModel.findUnique({
      where: { id: ratingId },
      select: { id: true, schoolId: true, isHidden: true },
    });

    if (!existing) {
      throw new NotFoundException('Community rating not found');
    }

    const rating = await this.ratingModel.update({
      where: { id: ratingId },
      data: {
        isHidden: false,
        hiddenAt: null,
        hiddenBy: null,
        hiddenReason: null,
      },
      select: {
        id: true,
        schoolId: true,
        isHidden: true,
        hiddenAt: true,
        hiddenBy: true,
        hiddenReason: true,
      },
    });

    await this.invalidateSchoolCaches(existing.schoolId);
    await this.auditLogService.log({
      userId: adminUserId,
      action: AuditAction.ADMIN_ACTION,
      resource: 'school-community-ratings',
      resourceId: ratingId,
      metadata: {
        action: 'restore',
        schoolId: existing.schoolId,
      },
    });

    return rating;
  }

  private async ensureSchoolExists(schoolId: string): Promise<void> {
    // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }
  }

  private async invalidateSchoolCaches(schoolId: string): Promise<void> {
    await Promise.all([
      this.redis.del(`school:detail:${schoolId}`),
      this.redis.delByPrefix('school:list:'),
    ]);
  }

  private createEmptySummary(): SchoolCommunityRatingSummary {
    return {
      count: 0,
      safetyAvg: null,
      lifeAvg: null,
      foodAvg: null,
      isPublic: false,
    };
  }

  private toPublicSummary(
    aggregate: RatingAggregate | null | undefined,
  ): SchoolCommunityRatingSummary {
    const count = aggregate?._count._all ?? 0;
    const isPublic = count >= MIN_PUBLIC_RATING_COUNT;

    return {
      count,
      safetyAvg: isPublic
        ? this.roundAverage(aggregate?._avg.safetyRating)
        : null,
      lifeAvg: isPublic ? this.roundAverage(aggregate?._avg.lifeRating) : null,
      foodAvg: isPublic ? this.roundAverage(aggregate?._avg.foodRating) : null,
      isPublic,
    };
  }

  private roundAverage(value: number | null | undefined): number | null {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return null;
    }
    return Math.round(value * 10) / 10;
  }
}
