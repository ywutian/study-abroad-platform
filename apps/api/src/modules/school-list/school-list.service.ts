import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSchoolListItemDto,
  UpdateSchoolListItemDto,
  SchoolListItemResponseDto,
  AIRecommendationsResponseDto,
  SchoolTier,
} from './dto/school-list.dto';
import {
  extractProfileMetrics,
  calculateOverallScore,
  calculateProbability,
  calculateTier,
} from '../../common/utils/scoring';
import { clampPercentRate } from '../../common/utils/percent.util';
import {
  SCHOOL_LIST_SCHOOL_SELECT,
  AI_RECOMMENDATION_SCHOOL_SELECT,
  mapSchoolForList,
} from './school-list.constants';

@Injectable()
export class SchoolListService {
  private readonly logger = new Logger(SchoolListService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all school list items for a user
   */
  async getUserSchoolList(
    userId: string,
  ): Promise<SchoolListItemResponseDto[]> {
    const items = await this.prisma.schoolListItem.findMany({
      where: { userId },
      include: {
        school: { select: SCHOOL_LIST_SCHOOL_SELECT },
      },
      orderBy: [{ tier: 'asc' }, { createdAt: 'desc' }],
    });

    // 批量查询预测数据
    let predMap = new Map<
      string,
      {
        probability: number;
        tier?: string;
        confidence?: string;
        source?: string;
        updatedAt: Date;
      }
    >();

    if (items.length > 0) {
      const profile = await this.prisma.profile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (profile) {
        const preds = await this.prisma.predictionResult.findMany({
          where: {
            profileId: profile.id,
            schoolId: { in: items.map((i) => i.schoolId) },
          },
          select: {
            schoolId: true,
            probability: true,
            tier: true,
            confidence: true,
            source: true,
            updatedAt: true,
          },
        });

        predMap = new Map(
          preds.map((p) => [
            p.schoolId,
            {
              probability: Number(p.probability),
              tier: p.tier || undefined,
              confidence: p.confidence || undefined,
              source: p.source || undefined,
              updatedAt: p.updatedAt,
            },
          ]),
        );
      }
    }

    return items.map((item) => ({
      id: item.id,
      schoolId: item.schoolId,
      school: mapSchoolForList(item.school),
      tier: item.tier,
      round: item.round || undefined,
      notes: item.notes || undefined,
      isAIRecommended: item.isAIRecommended,
      prediction: predMap.get(item.schoolId) || undefined,
      createdAt: item.createdAt,
    }));
  }

  /**
   * Add a school to user's list
   */
  async addSchool(
    userId: string,
    dto: CreateSchoolListItemDto,
  ): Promise<SchoolListItemResponseDto> {
    // Check if school exists
    const school = await this.prisma.school.findUnique({
      where: { id: dto.schoolId },
      select: SCHOOL_LIST_SCHOOL_SELECT,
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    // Check if already in list
    const existing = await this.prisma.schoolListItem.findUnique({
      where: {
        userId_schoolId: {
          userId,
          schoolId: dto.schoolId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('School already exists in your list');
    }

    // Create the item
    const item = await this.prisma.schoolListItem.create({
      data: {
        userId,
        schoolId: dto.schoolId,
        tier: dto.tier || SchoolTier.TARGET,
        round: dto.round,
        notes: dto.notes,
        isAIRecommended: dto.isAIRecommended ?? false,
      },
      include: {
        school: { select: SCHOOL_LIST_SCHOOL_SELECT },
      },
    });

    return {
      id: item.id,
      schoolId: item.schoolId,
      school: mapSchoolForList(school),
      tier: item.tier,
      round: item.round || undefined,
      notes: item.notes || undefined,
      isAIRecommended: item.isAIRecommended,
      createdAt: item.createdAt,
    };
  }

  /**
   * Update a school list item
   */
  async updateItem(
    userId: string,
    itemId: string,
    dto: UpdateSchoolListItemDto,
  ): Promise<SchoolListItemResponseDto> {
    const item = await this.prisma.schoolListItem.findFirst({
      where: { id: itemId, userId },
      include: {
        school: { select: SCHOOL_LIST_SCHOOL_SELECT },
      },
    });

    if (!item) {
      throw new NotFoundException('School list item not found');
    }

    const updated = await this.prisma.schoolListItem.update({
      where: { id: itemId },
      data: {
        tier: dto.tier,
        round: dto.round,
        notes: dto.notes,
      },
      include: {
        school: { select: SCHOOL_LIST_SCHOOL_SELECT },
      },
    });

    return {
      id: updated.id,
      schoolId: updated.schoolId,
      school: mapSchoolForList(updated.school),
      tier: updated.tier,
      round: updated.round || undefined,
      notes: updated.notes || undefined,
      isAIRecommended: updated.isAIRecommended,
      createdAt: updated.createdAt,
    };
  }

  /**
   * Remove a school from user's list
   */
  async removeItem(userId: string, itemId: string): Promise<void> {
    const item = await this.prisma.schoolListItem.findFirst({
      where: { id: itemId, userId },
    });

    if (!item) {
      throw new NotFoundException('School list item not found');
    }

    await this.prisma.schoolListItem.delete({
      where: { id: itemId },
    });
  }

  /**
   * Get AI recommendations based on user profile
   */
  async getAIRecommendations(
    userId: string,
  ): Promise<AIRecommendationsResponseDto> {
    // Get user profile
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        testScores: true,
        activities: true,
        awards: { include: { competition: true } },
      },
    });

    if (!profile) {
      throw new BadRequestException(
        'Profile not found. Please complete your profile first.',
      );
    }

    // 使用统一评分提取 ProfileMetrics
    const profileMetrics = extractProfileMetrics(profile);

    // Get schools
    const schools = await this.prisma.school.findMany({
      where: {
        usNewsRank: { not: null },
      },
      orderBy: { usNewsRank: 'asc' },
      take: 100,
      select: AI_RECOMMENDATION_SCHOOL_SELECT,
    });

    // 使用统一评分系统分类学校
    const safety: any[] = [];
    const target: any[] = [];
    const reach: any[] = [];

    for (const school of schools) {
      const schoolMetrics = {
        acceptanceRate:
          school.acceptanceRate != null
            ? clampPercentRate(school.acceptanceRate)
            : undefined,
        satAvg: school.satAvg ?? undefined,
        sat25: school.sat25 ?? undefined,
        sat75: school.sat75 ?? undefined,
        actAvg: school.actAvg ?? undefined,
        act25: school.act25 ?? undefined,
        act75: school.act75 ?? undefined,
        usNewsRank: school.usNewsRank ?? undefined,
        graduationRate:
          school.graduationRate != null
            ? Number(school.graduationRate)
            : undefined,
      };

      const overallScore = calculateOverallScore(profileMetrics, schoolMetrics);
      const probability = calculateProbability(overallScore, schoolMetrics);
      const tier = calculateTier(probability, schoolMetrics);

      const tierEnum =
        tier === 'safety'
          ? SchoolTier.SAFETY
          : tier === 'match'
            ? SchoolTier.TARGET
            : SchoolTier.REACH;

      const schoolItem = {
        id: `ai-${school.id}`,
        schoolId: school.id,
        school: mapSchoolForList(school),
        tier: tierEnum,
        isAIRecommended: true,
        createdAt: new Date(),
      };

      if (tierEnum === SchoolTier.REACH && reach.length < 5) {
        reach.push(schoolItem);
      } else if (tierEnum === SchoolTier.TARGET && target.length < 5) {
        target.push(schoolItem);
      } else if (tierEnum === SchoolTier.SAFETY && safety.length < 5) {
        safety.push(schoolItem);
      }

      if (reach.length >= 5 && target.length >= 5 && safety.length >= 5) {
        break;
      }
    }

    // 桥接：将快速评分结果异步写入 PredictionResult + PredictionSnapshot
    this.syncQuickMatchToPrediction(profile.id, schools, profileMetrics).catch(
      (err) => {
        this.logger.warn('Failed to sync quick-match to predictions', err);
      },
    );

    return { safety, target, reach };
  }

  /**
   * 桥接：将快速评分结果同步到 PredictionResult + PredictionSnapshot
   */
  private async syncQuickMatchToPrediction(
    profileId: string,
    schools: Array<{
      id: string;
      acceptanceRate: any;
      satAvg: number | null;
      sat25: number | null;
      sat75: number | null;
      actAvg: number | null;
      act25: number | null;
      act75: number | null;
      usNewsRank: number | null;
      graduationRate?: any;
    }>,
    profileMetrics: ReturnType<typeof extractProfileMetrics>,
  ): Promise<void> {
    for (const school of schools) {
      const schoolMetrics = {
        acceptanceRate:
          school.acceptanceRate != null
            ? clampPercentRate(school.acceptanceRate)
            : undefined,
        satAvg: school.satAvg ?? undefined,
        sat25: school.sat25 ?? undefined,
        sat75: school.sat75 ?? undefined,
        actAvg: school.actAvg ?? undefined,
        act25: school.act25 ?? undefined,
        act75: school.act75 ?? undefined,
        usNewsRank: school.usNewsRank ?? undefined,
        graduationRate:
          school.graduationRate != null
            ? Number(school.graduationRate)
            : undefined,
      };

      const overallScore = calculateOverallScore(profileMetrics, schoolMetrics);
      const probability = calculateProbability(overallScore, schoolMetrics);
      const tier = calculateTier(probability, schoolMetrics);

      try {
        // 防覆盖高质量结果
        const existing = await this.prisma.predictionResult.findUnique({
          where: {
            profileId_schoolId: { profileId, schoolId: school.id },
          },
          select: { modelVersion: true },
        });

        if (
          existing?.modelVersion === 'v3-enterprise' ||
          existing?.modelVersion === 'v2-ensemble' ||
          existing?.modelVersion === 'v2-recommendation-anchored' ||
          existing?.modelVersion === 'v1-recommendation-ai' ||
          existing?.modelVersion === 'v1-school-ai'
        )
          continue;

        await this.prisma.predictionResult.upsert({
          where: {
            profileId_schoolId: { profileId, schoolId: school.id },
          },
          update: {
            probability,
            tier,
            confidence: 'low',
            modelVersion: 'v1-stats',
            source: 'quick-match',
          },
          create: {
            profileId,
            schoolId: school.id,
            probability,
            tier,
            confidence: 'low',
            factors: [] as any,
            modelVersion: 'v1-stats',
            source: 'quick-match',
          },
        });

        await this.prisma.predictionSnapshot.create({
          data: {
            profileId,
            schoolId: school.id,
            probability,
            tier,
            confidence: 'low',
            source: 'quick-match',
            modelVersion: 'v1-stats',
          },
        });
      } catch (error) {
        this.logger.warn(
          `Failed to sync quick-match for school ${school.id}`,
          error,
        );
      }
    }
  }
}
