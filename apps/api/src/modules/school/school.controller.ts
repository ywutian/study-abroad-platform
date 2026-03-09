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
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SchoolService } from './school.service';
import { SchoolDataService } from './school-data.service';
import { SchoolScraperService } from './school-scraper.service';
import { SchoolDataMerger } from './school-data-merger';
import { SchoolLogoService } from './school-logo.service';
import { SchoolQueryDto } from './dto/school-query.dto';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import { Role } from '@prisma/client';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuditLogService,
  AuditAction,
} from '../../common/services/audit-log.service';
import { SchoolListService } from '../school-list/school-list.service';
import { clampPercentRate } from '../../common/utils/percent.util';

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
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly schoolLogoService: SchoolLogoService,
    private readonly schoolListService: SchoolListService,
  ) {}

  @Get('uc-ids')
  @Public()
  @ApiOperation({
    summary: 'Get school IDs for UC campuses (one-click prediction)',
  })
  async getUcSchoolIds() {
    return this.schoolService
      .getUcSchoolIds()
      .then((schoolIds) => ({ schoolIds }));
  }

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
   * Delegates to SchoolListService which uses the stats-based scoring pipeline.
   */
  @Get('ai/recommend')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get AI-powered school recommendations based on user profile',
  })
  async getAIRecommendations(@CurrentUser() user: CurrentUserPayload) {
    const emptyResult = { reach: [], target: [], safety: [], summary: '' };

    // Check Redis cache
    const cacheKey = `ai:recommend:${user.id}`;
    const cached = await this.redis.getJSON<any>(cacheKey);
    if (cached) {
      return { ...cached, status: 'cached' as const };
    }

    try {
      const result = await this.schoolListService.getAIRecommendations(user.id);

      const mapped = {
        reach: result.reach,
        target: result.target,
        safety: result.safety,
        summary: '',
      };

      await this.redis.setJSON(cacheKey, mapped, 7200);
      return { ...mapped, status: 'fresh' as const };
    } catch (error) {
      this.logger.error(
        `AI recommendation failed for user ${user.id}: ${error instanceof Error ? error.message : error}`,
      );
      return { ...emptyResult, status: 'ai_error' as const };
    }
  }

  @Get(':id/logo-suggestion')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get suggested logo URL from school website domain (admin only)',
  })
  async getLogoSuggestion(@Param('id') id: string) {
    if (!this.schoolLogoService.isConfigured()) {
      throw new BadRequestException('LOGO_DEV_TOKEN is not configured');
    }
    const school = await this.schoolService.findById(id);
    if (!school?.website) {
      throw new NotFoundException('School has no website');
    }
    if (school.logoUrl) {
      throw new BadRequestException('School already has a logo URL');
    }
    const suggested = this.schoolLogoService.getSuggestedLogoUrl(
      school.website,
    );
    if (!suggested) {
      throw new NotFoundException('Could not derive logo URL from website');
    }
    return { suggestedLogoUrl: suggested };
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
  async update(
    @Param('id') id: string,
    @Body() data: UpdateSchoolDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const school = await this.schoolService.update(id, data);
    await this.schoolService.invalidateSchoolCache(id);
    await this.auditLogService.log({
      userId: user.id,
      action: AuditAction.ADMIN_ACTION,
      resource: 'schools',
      resourceId: id,
      metadata: { updatedFields: Object.keys(data) },
    });
    return {
      ...school,
      acceptanceRate:
        clampPercentRate(school.acceptanceRate) ?? school.acceptanceRate,
      graduationRate:
        clampPercentRate(school.graduationRate) ?? school.graduationRate,
    };
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

  /**
   * Check if Logo.dev auto-fill is configured (LOGO_DEV_TOKEN set).
   */
  @Get('admin/logo-fill-status')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Check if logo fill by domain is available (admin only)',
  })
  getLogoFillStatus() {
    return { configured: this.schoolLogoService.isConfigured() };
  }

  /**
   * Fill logoUrl for schools that have website but no logo, using Logo.dev by domain.
   * Admin only. Requires LOGO_DEV_TOKEN.
   */
  @Post('admin/fill-logos-by-domain')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Fill school logos by website domain via Logo.dev (admin only)',
  })
  async fillLogosByDomain(
    @Body() body: { limit?: number },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const limit = Math.min(Math.max(1, body?.limit ?? 100), 500);
    return this.schoolLogoService.fillLogosByDomain(limit, user.id);
  }
}
