import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SchoolService } from './school.service';
import { SchoolDataService } from './school-data.service';
import { SchoolScraperService } from './school-scraper.service';
import { SchoolQueryDto } from './dto/school-query.dto';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { ProfileService } from '../profile/profile.service';

@ApiTags('schools')
@Controller('schools')
export class SchoolController {
  constructor(
    private readonly schoolService: SchoolService,
    private readonly schoolDataService: SchoolDataService,
    private readonly schoolScraperService: SchoolScraperService,
    private readonly aiService: AiService,
    private readonly profileService: ProfileService,
  ) {}

  @Get()
  @Public()
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

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get school by ID' })
  async findById(@Param('id') id: string) {
    return this.schoolService.findById(id);
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
    // 获取用户档案
    const profile = await this.profileService.findByUserId(user.id);

    // 获取学校列表（Top 100）
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

    // 调用 AI 推荐
    const recommendations = await this.aiService.recommendSchools(
      profileRequest,
      schools,
    );

    // 关联学校详细信息
    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    const enrichRecommendations = (items: any[]) =>
      items.map((item) => ({
        ...item,
        school: schoolMap.get(item.schoolId),
      }));

    return {
      reach: enrichRecommendations(recommendations.reach),
      target: enrichRecommendations(recommendations.target),
      safety: enrichRecommendations(recommendations.safety),
      summary: recommendations.summary,
    };
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
