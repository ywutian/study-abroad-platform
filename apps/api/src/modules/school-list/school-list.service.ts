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
import { EssayStatus } from '@prisma/client';
import {
  SCHOOL_LIST_SCHOOL_SELECT,
  AI_RECOMMENDATION_SCHOOL_SELECT,
  mapSchoolForList,
} from './school-list.constants';
import { CacheInvalidationService } from '../../common/redis/cache-invalidation.service';

@Injectable()
export class SchoolListService {
  private readonly logger = new Logger(SchoolListService.name);

  constructor(
    private prisma: PrismaService,
    private cacheInvalidation: CacheInvalidationService,
  ) {}

  /**
   * Get available application rounds for a school from deadline data
   */
  async getAvailableRounds(schoolId: string): Promise<string[]> {
    const deadlines = await this.prisma.schoolDeadline.findMany({
      where: { schoolId },
      select: { round: true },
      distinct: ['round'],
    });
    return deadlines.map((d) => d.round);
  }

  /**
   * Validate round for binding exclusivity and availability.
   * Shared by addSchool() and updateItem().
   */
  private async validateRound(
    userId: string,
    schoolId: string,
    round: string,
    excludeItemId?: string,
  ): Promise<void> {
    const roundUpper = round.toUpperCase();
    const BINDING_ROUNDS = ['ED', 'ED2', 'REA', 'SCEA'];
    const excludeFilter = excludeItemId ? { id: { not: excludeItemId } } : {};

    if (BINDING_ROUNDS.includes(roundUpper)) {
      // 1. Same binding round — only one school allowed
      const existingBinding = await this.prisma.schoolListItem.findFirst({
        where: {
          userId,
          round: { in: [roundUpper, roundUpper.toLowerCase()] },
          ...excludeFilter,
        },
        include: { school: { select: { name: true } } },
      });

      if (existingBinding) {
        throw new ConflictException({
          code: 'SCHOOL_LIST_BINDING_CONFLICT',
          message: `You already have an ${roundUpper} application to ${existingBinding.school.name}. ${roundUpper} is binding — only one school allowed.`,
          details: {
            round: roundUpper,
            conflictingSchool: existingBinding.school.name,
          },
        });
      }

      // 2. ED/ED2 ↔ REA/SCEA mutual exclusion
      if (['ED', 'ED2'].includes(roundUpper)) {
        const conflictItem = await this.prisma.schoolListItem.findFirst({
          where: {
            userId,
            round: { in: ['REA', 'SCEA', 'rea', 'scea'] },
            ...excludeFilter,
          },
          include: { school: { select: { name: true } } },
        });
        if (conflictItem) {
          throw new ConflictException({
            code: 'SCHOOL_LIST_BINDING_CONFLICT',
            message: `Cannot apply ${roundUpper} because you have a ${conflictItem.round} application to ${conflictItem.school.name}. ED/ED2 and REA/SCEA are mutually exclusive.`,
            details: {
              round: roundUpper,
              conflictingRound: conflictItem.round,
              conflictingSchool: conflictItem.school.name,
            },
          });
        }
      } else if (['REA', 'SCEA'].includes(roundUpper)) {
        const conflictItem = await this.prisma.schoolListItem.findFirst({
          where: {
            userId,
            round: { in: ['ED', 'ED2', 'ed', 'ed2'] },
            ...excludeFilter,
          },
          include: { school: { select: { name: true } } },
        });
        if (conflictItem) {
          throw new ConflictException({
            code: 'SCHOOL_LIST_BINDING_CONFLICT',
            message: `Cannot apply ${roundUpper} because you have a ${conflictItem.round} application to ${conflictItem.school.name}. ED/ED2 and REA/SCEA are mutually exclusive.`,
            details: {
              round: roundUpper,
              conflictingRound: conflictItem.round,
              conflictingSchool: conflictItem.school.name,
            },
          });
        }
      }
    }

    // 3. Round availability check (only if school has deadline data)
    const available = await this.getAvailableRounds(schoolId);
    if (available.length > 0 && !available.includes(round)) {
      throw new BadRequestException({
        code: 'SCHOOL_LIST_ROUND_UNAVAILABLE',
        message: `Round "${round}" is not available for this school. Available rounds: ${available.join(', ')}`,
        details: { round, availableRounds: available },
      });
    }
  }

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

    // 批量查询文书题目数量
    let essayCountMap = new Map<string, number>();
    if (items.length > 0) {
      const counts = await this.prisma.essayPrompt.groupBy({
        by: ['schoolId'],
        where: {
          schoolId: { in: items.map((i) => i.schoolId) },
          isActive: true,
          status: EssayStatus.VERIFIED,
        },
        _count: true,
      });
      essayCountMap = new Map(counts.map((c) => [c.schoolId, c._count]));
    }

    // 批量查询截止日期 (当前申请年份)
    const deadlineMap = new Map<
      string,
      Array<{
        round: string;
        applicationDeadline: string;
        financialAidDeadline?: string;
        interviewRequired: boolean;
        interviewDeadline?: string;
        interviewFormat?: string;
      }>
    >();
    if (items.length > 0) {
      const currentYear = new Date().getFullYear();
      const applicationYear =
        new Date().getMonth() >= 7 ? currentYear + 1 : currentYear;
      const deadlines = await this.prisma.schoolDeadline.findMany({
        where: {
          schoolId: { in: items.map((i) => i.schoolId) },
          year: applicationYear,
        },
        select: {
          schoolId: true,
          round: true,
          applicationDeadline: true,
          financialAidDeadline: true,
          interviewRequired: true,
          interviewDeadline: true,
          interviewFormat: true,
        },
        orderBy: { applicationDeadline: 'asc' },
      });

      for (const dl of deadlines) {
        const existing = deadlineMap.get(dl.schoolId) || [];
        existing.push({
          round: dl.round,
          applicationDeadline: dl.applicationDeadline.toISOString(),
          financialAidDeadline: dl.financialAidDeadline?.toISOString(),
          interviewRequired: dl.interviewRequired,
          interviewDeadline: dl.interviewDeadline?.toISOString(),
          interviewFormat: dl.interviewFormat || undefined,
        });
        deadlineMap.set(dl.schoolId, existing);
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
      essayPromptCount: essayCountMap.get(item.schoolId) || 0,
      deadlines: deadlineMap.get(item.schoolId) || [],
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
      throw new ConflictException({
        code: 'SCHOOL_LIST_DUPLICATE',
        message: 'School already exists in your list',
      });
    }

    // Validate round: binding exclusivity + availability
    if (dto.round) {
      await this.validateRound(userId, dto.schoolId, dto.round);
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

    await this.cacheInvalidation.onProfileChange(userId);

    const essayCount = await this.prisma.essayPrompt.count({
      where: {
        schoolId: item.schoolId,
        isActive: true,
        status: EssayStatus.VERIFIED,
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
      essayPromptCount: essayCount,
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

    // Validate round: binding exclusivity + availability
    if (dto.round) {
      await this.validateRound(userId, item.schoolId, dto.round, itemId);
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

    await this.cacheInvalidation.onProfileChange(userId);

    const essayCount = await this.prisma.essayPrompt.count({
      where: {
        schoolId: updated.schoolId,
        isActive: true,
        status: EssayStatus.VERIFIED,
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
      essayPromptCount: essayCount,
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

    await this.cacheInvalidation.onProfileChange(userId);
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

    // Bridge: write quick-match estimates to PredictionResult as PREVIEW authority.
    // Never writes PredictionSnapshot — snapshots are the time-series of real
    // served predictions used by distillation / reporting / trend UI.
    this.syncQuickMatchToPrediction(profile.id, schools, profileMetrics).catch(
      (err) => {
        this.logger.warn('Failed to sync quick-match to predictions', err);
      },
    );

    return { safety, target, reach };
  }

  /**
   * Bridge: sync quick-match estimates to PredictionResult with authority=PREVIEW.
   * Invariant (enforced at line ~594 + in check-integration): PREVIEW must never
   * overwrite AUTHORITATIVE. No PredictionSnapshot writes — preview belongs only
   * on PredictionResult (the school-list UI column source).
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
        // Authority invariant: PREVIEW must never overwrite AUTHORITATIVE.
        // This replaces the legacy modelVersion allowlist so that every
        // future authoritative model (Scorecard, v4, ML champion, etc.) is
        // automatically protected without touching this file.
        const existing = await this.prisma.predictionResult.findUnique({
          where: {
            profileId_schoolId: { profileId, schoolId: school.id },
          },
          select: { authority: true },
        });

        if (existing && existing.authority === 'AUTHORITATIVE') continue;

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
            authority: 'PREVIEW',
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
            authority: 'PREVIEW',
          },
        });

        // Intentionally NOT writing PredictionSnapshot here: snapshots are the
        // time-series of real served predictions (read by the Chinese-cohort
        // distillation teacher, reporting, UI trend graph). Preview estimates
        // are only for the school-list UI column and will be superseded when
        // the user triggers a full predict.
      } catch (error) {
        this.logger.warn(
          `Failed to sync quick-match for school ${school.id}`,
          error,
        );
      }
    }
  }
}
