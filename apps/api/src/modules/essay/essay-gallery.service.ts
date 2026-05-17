import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EssayAiService } from './essay-ai.service';
import { PointsService, PointAction } from '../points/incentive.service';
import { safeRefund } from '../points/refund.helper';
import {
  CASE_PUBLIC_WHERE,
  GALLERY_LIST_SELECT,
  GALLERY_DETAIL_SELECT,
} from './constants/essay-gallery.constants';

@Injectable()
export class EssayGalleryService {
  private readonly logger = new Logger(EssayGalleryService.name);

  constructor(
    private prisma: PrismaService,
    private essayAiService: EssayAiService,
    private pointsService: PointsService,
  ) {}

  /**
   * 获取公开优秀文书列表
   * 来源：录取案例中公开分享的文书
   */
  async getGalleryEssays(filters: {
    school?: string;
    type?: 'COMMON_APP' | 'UC' | 'SUPPLEMENTAL' | 'WHY_SCHOOL' | 'OTHER';
    promptNumber?: number;
    year?: number;
    result?: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';
    rankMin?: number;
    rankMax?: number;
    isVerified?: boolean;
    sortBy?: 'newest' | 'popular';
    page: number;
    pageSize: number;
  }) {
    const {
      school,
      type,
      promptNumber,
      year,
      result,
      rankMin,
      rankMax,
      isVerified,
      sortBy,
      page,
      pageSize,
    } = filters;
    const skip = (page - 1) * pageSize;

    // 构建查询条件
    const where: any = { ...CASE_PUBLIC_WHERE };

    // 文书类型筛选
    if (type) {
      where.essayType = type;
    }

    // Common App/UC 题号筛选
    if (promptNumber) {
      where.promptNumber = promptNumber;
    }

    // 年份筛选
    if (year) {
      where.year = year;
    }

    // 录取结果筛选
    if (result) {
      where.result = result;
    }

    // 仅显示已验证
    if (isVerified) {
      where.isVerified = true;
    }

    // 学校名称搜索
    if (school) {
      where.school = {
        OR: [
          { name: { contains: school, mode: 'insensitive' } },
          { nameZh: { contains: school, mode: 'insensitive' } },
        ],
      };
    }

    // 学校排名范围筛选
    if (rankMin !== undefined || rankMax !== undefined) {
      where.school = {
        ...where.school,
        usNewsRank: {
          ...(rankMin !== undefined && { gte: rankMin }),
          ...(rankMax !== undefined && { lte: rankMax }),
        },
      };
    }

    // 排序逻辑
    const orderBy =
      sortBy === 'popular'
        ? [{ isVerified: 'desc' as const }, { createdAt: 'desc' as const }]
        : [{ createdAt: 'desc' as const }, { isVerified: 'desc' as const }];

    const [cases, total, stats] = await Promise.all([
      this.prisma.admissionCase.findMany({
        where,
        select: GALLERY_LIST_SELECT,
        skip,
        take: pageSize,
        orderBy,
      }),
      this.prisma.admissionCase.count({ where }),
      this.getGalleryStats(),
    ]);

    // 处理返回数据
    const essays = cases.map((c) => ({
      id: c.id,
      year: c.year,
      result: c.result,
      essayType: c.essayType,
      promptNumber: c.promptNumber,
      prompt: c.essayPrompt,
      preview: c.essayContent ? c.essayContent.slice(0, 200) + '...' : null,
      wordCount: c.essayContent ? c.essayContent.split(/\s+/).length : 0,
      school: c.school,
      tags: c.tags,
      isVerified: c.isVerified,
    }));

    return {
      items: essays,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats,
    };
  }

  /**
   * 获取文书画廊统计数据
   */
  private async getGalleryStats() {
    const baseWhere = { ...CASE_PUBLIC_WHERE };

    const [total, admitted, top20, byType] = await Promise.all([
      this.prisma.admissionCase.count({ where: baseWhere }),
      this.prisma.admissionCase.count({
        where: { ...baseWhere, result: 'ADMITTED' },
      }),
      this.prisma.admissionCase.count({
        where: {
          ...baseWhere,
          school: { usNewsRank: { lte: 20 } },
        },
      }),
      this.prisma.admissionCase.groupBy({
        by: ['essayType'],
        where: baseWhere,
        _count: true,
      }),
    ]);

    return {
      total,
      admitted,
      top20,
      byType: byType.reduce(
        (acc, item) => {
          if (item.essayType) {
            acc[item.essayType] = item._count;
          }
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  /**
   * 获取单篇公开文书详情
   */
  async getGalleryEssayDetail(caseId: string) {
    const admissionCase = await this.prisma.admissionCase.findFirst({
      where: {
        id: caseId,
        ...CASE_PUBLIC_WHERE,
      },
      select: GALLERY_DETAIL_SELECT,
    });

    if (!admissionCase) {
      throw new NotFoundException('Essay not found or not public');
    }

    return {
      id: admissionCase.id,
      year: admissionCase.year,
      round: admissionCase.round,
      result: admissionCase.result,
      essayType: admissionCase.essayType,
      promptNumber: admissionCase.promptNumber,
      prompt: admissionCase.essayPrompt,
      content: admissionCase.essayContent,
      wordCount: admissionCase.essayContent?.split(/\s+/).length || 0,
      gpaRange: admissionCase.gpaRange,
      satRange: admissionCase.satRange,
      school: admissionCase.school,
      tags: admissionCase.tags,
      isVerified: admissionCase.isVerified,
      isAnonymous: admissionCase.visibility === 'ANONYMOUS',
    };
  }

  /**
   * 逐段分析公开文书
   */
  async analyzeGalleryEssay(
    userId: string,
    caseId: string,
    schoolName?: string,
    locale = 'zh',
  ) {
    await this.pointsService.charge(userId, PointAction.AI_ESSAY_GALLERY);

    const essay = await this.getGalleryEssayDetail(caseId);

    if (!essay.content) {
      await safeRefund(
        this.pointsService,
        userId,
        PointAction.AI_ESSAY_GALLERY,
        this.logger,
      );
      throw new BadRequestException('Essay content is empty');
    }

    try {
      const analysis = await this.essayAiService.analyzeEssayParagraphs(
        essay.content,
        essay.prompt || undefined,
        schoolName || essay.school?.name,
        locale,
      );

      return {
        essayId: caseId,
        ...analysis,
        tokenUsed: this.estimateTokens(essay.content),
      };
    } catch (error) {
      await safeRefund(
        this.pointsService,
        userId,
        PointAction.AI_ESSAY_GALLERY,
        this.logger,
      );
      this.logger.error('Gallery essay analysis failed', error);
      throw new BadRequestException('Failed to analyze essay');
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 3);
  }
}
