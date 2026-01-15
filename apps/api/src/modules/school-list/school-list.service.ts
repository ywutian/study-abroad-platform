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
        school: {
          select: {
            id: true,
            name: true,
            nameZh: true,
            usNewsRank: true,
            acceptanceRate: true,
            tuition: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: [{ tier: 'asc' }, { createdAt: 'desc' }],
    });

    return items.map((item) => ({
      id: item.id,
      schoolId: item.schoolId,
      school: {
        id: item.school.id,
        name: item.school.name,
        nameZh: item.school.nameZh || undefined,
        usNewsRank: item.school.usNewsRank || undefined,
        acceptanceRate: item.school.acceptanceRate
          ? Number(item.school.acceptanceRate)
          : undefined,
        tuition: item.school.tuition || undefined,
        city: item.school.city || undefined,
        state: item.school.state || undefined,
      },
      tier: item.tier,
      round: item.round || undefined,
      notes: item.notes || undefined,
      isAIRecommended: item.isAIRecommended,
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
      select: {
        id: true,
        name: true,
        nameZh: true,
        usNewsRank: true,
        acceptanceRate: true,
        tuition: true,
        city: true,
        state: true,
      },
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
      },
      include: {
        school: {
          select: {
            id: true,
            name: true,
            nameZh: true,
            usNewsRank: true,
            acceptanceRate: true,
            tuition: true,
            city: true,
            state: true,
          },
        },
      },
    });

    return {
      id: item.id,
      schoolId: item.schoolId,
      school: {
        id: school.id,
        name: school.name,
        nameZh: school.nameZh || undefined,
        usNewsRank: school.usNewsRank || undefined,
        acceptanceRate: school.acceptanceRate
          ? Number(school.acceptanceRate)
          : undefined,
        tuition: school.tuition || undefined,
        city: school.city || undefined,
        state: school.state || undefined,
      },
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
        school: {
          select: {
            id: true,
            name: true,
            nameZh: true,
            usNewsRank: true,
            acceptanceRate: true,
            tuition: true,
            city: true,
            state: true,
          },
        },
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
        school: {
          select: {
            id: true,
            name: true,
            nameZh: true,
            usNewsRank: true,
            acceptanceRate: true,
            tuition: true,
            city: true,
            state: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      schoolId: updated.schoolId,
      school: {
        id: updated.school.id,
        name: updated.school.name,
        nameZh: updated.school.nameZh || undefined,
        usNewsRank: updated.school.usNewsRank || undefined,
        acceptanceRate: updated.school.acceptanceRate
          ? Number(updated.school.acceptanceRate)
          : undefined,
        tuition: updated.school.tuition || undefined,
        city: updated.school.city || undefined,
        state: updated.school.state || undefined,
      },
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
      select: {
        id: true,
        name: true,
        nameZh: true,
        usNewsRank: true,
        acceptanceRate: true,
        satAvg: true,
        sat25: true,
        sat75: true,
        actAvg: true,
        act25: true,
        act75: true,
        tuition: true,
        city: true,
        state: true,
      },
    });

    // 使用统一评分系统分类学校
    const safety: any[] = [];
    const target: any[] = [];
    const reach: any[] = [];

    for (const school of schools) {
      const schoolMetrics = {
        acceptanceRate: school.acceptanceRate
          ? Number(school.acceptanceRate)
          : undefined,
        satAvg: school.satAvg ?? undefined,
        sat25: school.sat25 ?? undefined,
        sat75: school.sat75 ?? undefined,
        actAvg: school.actAvg ?? undefined,
        act25: school.act25 ?? undefined,
        act75: school.act75 ?? undefined,
        usNewsRank: school.usNewsRank ?? undefined,
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
        school: {
          id: school.id,
          name: school.name,
          nameZh: school.nameZh || undefined,
          usNewsRank: school.usNewsRank || undefined,
          acceptanceRate: school.acceptanceRate
            ? Number(school.acceptanceRate)
            : undefined,
          tuition: school.tuition || undefined,
          city: school.city || undefined,
          state: school.state || undefined,
        },
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

    return { safety, target, reach };
  }
}
