import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Header,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SchoolService } from './school.service';
import { SchoolDataService } from './school-data.service';
import { SchoolScraperService } from './school-scraper.service';
import { SchoolDataMerger } from './school-data-merger';
import { SchoolQueryDto } from './dto/school-query.dto';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import { Role } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { ProfileService } from '../profile/profile.service';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('schools')
@ThrottleRelaxed()
@Controller('schools')
export class SchoolController {
  private readonly logger = new Logger(SchoolController.name);

  constructor(
    private readonly schoolService: SchoolService,
    private readonly schoolDataService: SchoolDataService,
    private readonly schoolScraperService: SchoolScraperService,
    private readonly schoolDataMerger: SchoolDataMerger,
    private readonly aiService: AiService,
    private readonly profileService: ProfileService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Public()
  @Header(
    'Cache-Control',
    'public, max-age=60, s-maxage=300, stale-while-revalidate=60',
  )
  @ApiOperation({ summary: 'Get all schools with advanced filters' })
  async findAll(@Query() query: SchoolQueryDto) {
    const {
      page,
      pageSize,
      country,
      search,
      state,
      region,
      rankMin,
      rankMax,
      acceptanceMin,
      acceptanceMax,
      tuitionMin,
      tuitionMax,
      sizeMin,
      sizeMax,
      schoolType,
      testOptional,
      needBlind,
      hasEarlyDecision,
    } = query;

    return this.schoolService.findAll(
      { page, pageSize },
      {
        country,
        search,
        state,
        region,
        rankMin,
        rankMax,
        acceptanceMin,
        acceptanceMax,
        tuitionMin,
        tuitionMax,
        sizeMin,
        sizeMax,
        schoolType,
        testOptional,
        needBlind,
        hasEarlyDecision,
      },
    );
  }

  /**
   * 学校数据质量报告
   * 返回各字段覆盖率和缺失最多的学校列表
   */
  @Get('admin/data-quality')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get school data quality report (admin only)' })
  async getDataQualityReport() {
    return this.schoolService.getDataQualityReport();
  }

  /**
   * 获取学校字段来源追踪记录
   */
  @Get('admin/provenance/:id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get field provenance for a school (admin only)' })
  async getProvenance(@Param('id') id: string) {
    return this.schoolDataMerger.getProvenance(id);
  }

  /**
   * P1: AI 个性化选校推荐
   * 根据用户档案返回 Safety/Target/Reach 分类的学校推荐
   */
  @Get('ai/recommend')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get AI-powered school recommendations based on user profile',
  })
  async getAIRecommendations(@CurrentUser() user: CurrentUserPayload) {
    const emptyResult = { reach: [], target: [], safety: [], summary: '' };

    // 1. 获取用户档案
    const profile = await this.profileService.findByUserId(user.id);
    if (!profile) {
      return { ...emptyResult, status: 'profile_incomplete' as const };
    }

    // 2. 检查 Redis 缓存
    const cacheKey = `ai:recommend:${user.id}`;
    const cached = await this.redis.getJSON<any>(cacheKey);
    if (cached) {
      return { ...cached, status: 'cached' as const };
    }

    // 3. 并行获取学校列表
    const schoolsResult = await this.schoolService.findAll(
      { page: 1, pageSize: 100 },
      {},
    );

    const schools = (schoolsResult.items || []).map((s) => ({
      id: s.id,
      name: s.name,
      nameZh: s.nameZh || undefined,
      usNewsRank: s.usNewsRank || undefined,
      acceptanceRate: s.acceptanceRate ? Number(s.acceptanceRate) : undefined,
      satRange: s.sat25 && s.sat75 ? `${s.sat25}-${s.sat75}` : undefined,
      actRange: s.act25 && s.act75 ? `${s.act25}-${s.act75}` : undefined,
    }));

    // 构建档案请求
    const profileRequest = {
      gpa: profile?.gpa ? Number(profile.gpa) : undefined,
      gpaScale: profile?.gpaScale ? Number(profile.gpaScale) : 4.0,
      testScores:
        (profile as any)?.testScores?.map((s: any) => ({
          type: s.type,
          score: s.score,
        })) || [],
      activities:
        (profile as any)?.activities?.map((a: any) => ({
          name: a.name,
          category: a.category,
          role: a.role,
        })) || [],
      awards:
        (profile as any)?.awards?.map((a: any) => ({
          name: a.name,
          level: a.level,
        })) || [],
      targetMajor: profile?.targetMajor || undefined,
    };

    // 4. 调用 AI 推荐（带 catch 降级）
    let recommendations;
    try {
      recommendations = await this.aiService.recommendSchools(
        profileRequest,
        schools,
        user.locale,
      );
    } catch (error) {
      this.logger.error(
        `AI recommendation failed for user ${user.id}: ${error instanceof Error ? error.message : error}`,
      );
      return { ...emptyResult, status: 'ai_error' as const };
    }

    // 关联学校详细信息
    const schoolMap = new Map(schools.map((s) => [s.id, s]));
    const enrichRecommendations = (items: any[]) =>
      items.map((item) => ({
        ...item,
        school: schoolMap.get(item.schoolId),
      }));

    const result = {
      reach: enrichRecommendations(recommendations.reach),
      target: enrichRecommendations(recommendations.target),
      safety: enrichRecommendations(recommendations.safety),
      summary: recommendations.summary,
    };

    // 5. 写入 Redis 缓存（TTL 2h）
    await this.redis.setJSON(cacheKey, result, 7200);

    // 6. 桥接：将 AI 推荐结果同步到 PredictionResult（异步非阻塞）
    this.syncAIRecommendToPrediction(user.id, result).catch((err) => {
      this.logger.warn('Failed to sync AI recommend to predictions', err);
    });

    return { ...result, status: 'fresh' as const };
  }

  /**
   * 桥接：将 /schools/ai/recommend 结果同步到 PredictionResult
   */
  private async syncAIRecommendToPrediction(
    userId: string,
    result: { reach: any[]; target: any[]; safety: any[] },
  ): Promise<void> {
    const profile = await this.prisma.profile.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return;

    const allSchools = [
      ...result.reach.map((s: any) => ({ ...s, tier: 'reach' })),
      ...result.target.map((s: any) => ({ ...s, tier: 'match' })),
      ...result.safety.map((s: any) => ({ ...s, tier: 'safety' })),
    ];

    for (const school of allSchools) {
      if (!school.schoolId) continue;

      const probability = (school.probability || 50) / 100;

      try {
        // 防覆盖高质量结果
        const existing = await this.prisma.predictionResult.findUnique({
          where: {
            profileId_schoolId: {
              profileId: profile.id,
              schoolId: school.schoolId,
            },
          },
          select: { modelVersion: true },
        });

        if (
          existing?.modelVersion === 'v2-ensemble' ||
          existing?.modelVersion === 'v1-recommendation-ai'
        )
          continue;

        await this.prisma.predictionResult.upsert({
          where: {
            profileId_schoolId: {
              profileId: profile.id,
              schoolId: school.schoolId,
            },
          },
          update: {
            probability,
            tier: school.tier,
            confidence: 'medium',
            modelVersion: 'v1-school-ai',
            source: 'ai-recommend',
          },
          create: {
            profileId: profile.id,
            schoolId: school.schoolId,
            probability,
            tier: school.tier,
            confidence: 'medium',
            factors: [] as any,
            modelVersion: 'v1-school-ai',
            source: 'ai-recommend',
          },
        });

        await this.prisma.predictionSnapshot.create({
          data: {
            profileId: profile.id,
            schoolId: school.schoolId,
            probability,
            tier: school.tier,
            confidence: 'medium',
            source: 'ai-recommend',
            modelVersion: 'v1-school-ai',
          },
        });
      } catch (error) {
        this.logger.warn(
          `Failed to sync AI recommend for school ${school.schoolId}`,
          error,
        );
      }
    }
  }

  @Get(':id')
  @Public()
  @Header(
    'Cache-Control',
    'public, max-age=300, s-maxage=3600, stale-while-revalidate=300',
  )
  @ApiOperation({ summary: 'Get school by ID' })
  async findById(@Param('id') id: string) {
    return this.schoolService.findById(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create school (admin only)' })
  async create(@Body() data: CreateSchoolDto) {
    return this.schoolService.create(data);
  }

  @Put(':id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update school (admin only)' })
  async update(@Param('id') id: string, @Body() data: UpdateSchoolDto) {
    return this.schoolService.update(id, data);
  }

  /**
   * 从 College Scorecard 同步学校数据
   * 仅管理员可用
   */
  @Post('sync/scorecard')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Sync schools from College Scorecard API (admin only)',
  })
  async syncFromScorecard(@Query('limit') limit?: number) {
    return this.schoolDataService.syncSchoolsFromScorecard(limit || 500);
  }

  /**
   * 从学校官网爬取申请信息
   *
   * 爬取内容:
   * - 文书题目
   * - 申请截止日期
   * - 录取要求 (GPA, SAT, TOEFL 等)
   */
  @Post('scrape/all')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Scrape admission info from school websites (admin only)',
  })
  async scrapeAllSchools() {
    return this.schoolScraperService.scrapeAllSchools();
  }

  /**
   * 获取已配置爬虫的学校列表
   */
  @Get('scrape/configured')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get list of schools configured for scraping' })
  async getConfiguredSchools() {
    return {
      schools: this.schoolScraperService.getConfiguredSchools(),
      total: this.schoolScraperService.getConfiguredSchools().length,
    };
  }
}
