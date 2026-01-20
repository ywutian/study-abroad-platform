import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Query,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EssayScraperService } from './essay-scraper.service';
import { EssayScraperScheduler } from './essay-scraper.scheduler';
import { Roles, CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Role } from '@prisma/client';
import { SourceType } from '../../common/types/enums';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSchoolEssaySourceDto,
  UpdateSchoolEssaySourceDto,
  TestScrapeDto,
  ConfirmSaveDto,
} from './dto/school-essay-source.dto';

@ApiTags('admin/essay-scraper')
@ApiBearerAuth()
@Controller('admin/essay-scraper')
@Roles(Role.ADMIN)
export class EssayScraperController {
  constructor(
    private readonly scraperService: EssayScraperService,
    private readonly scheduler: EssayScraperScheduler,
    private readonly prisma: PrismaService,
  ) {}

  // ============ Core Scraping ============

  @Get('schools')
  @ApiOperation({ summary: '获取可爬取的学校列表' })
  async getConfiguredSchools() {
    return {
      schools: await this.scraperService.getConfiguredSchools(),
    };
  }

  @Post('scrape')
  @ApiOperation({ summary: '爬取单个学校的文书题目' })
  async scrapeSchool(
    @Body()
    body: {
      schoolName: string;
      year?: number;
      sources?: SourceType[];
    },
  ) {
    const { schoolName, year, sources } = body;
    return this.scraperService.scrapeSchool(schoolName, year, sources);
  }

  @Post('scrape-all')
  @ApiOperation({ summary: '爬取所有配置学校的文书题目' })
  async scrapeAllSchools(@Query('year') year?: number) {
    return this.scraperService.scrapeAllSchools(year);
  }

  // ============ Test Scrape (Preview) ============

  @Post('test-scrape')
  @ApiOperation({ summary: '测试采集（预览，不写入 DB）' })
  async testScrape(@Body() dto: TestScrapeDto) {
    return this.scraperService.testScrapeSchool(dto.schoolName, dto.year);
  }

  @Post('confirm-save')
  @ApiOperation({ summary: '确认保存测试采集结果' })
  async confirmSave(@Body() dto: ConfirmSaveDto) {
    const saved = await this.scraperService.confirmSave(
      dto.data,
      dto.selectedIndices,
    );
    return { saved };
  }

  // ============ Pipeline Management ============

  @Post('pipeline/start')
  @ApiOperation({ summary: '手动启动全量采集管道' })
  async startPipeline(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { year?: number },
  ) {
    const runId = await this.scheduler.runPipeline('MANUAL', user.id);
    return { runId, status: 'RUNNING' };
  }

  @Get('pipeline/runs')
  @ApiOperation({ summary: '管道运行历史' })
  async listPipelineRuns(@Query('limit') limit?: number) {
    return this.prisma.essayPipelineRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit || 10,
    });
  }

  @Get('pipeline/:runId')
  @ApiOperation({ summary: '查看管道运行状态' })
  async getPipelineStatus(@Param('runId') runId: string) {
    return this.prisma.essayPipelineRun.findUnique({
      where: { id: runId },
    });
  }

  // ============ Dashboard ============

  @Get('dashboard/coverage')
  @ApiOperation({ summary: '文书覆盖率统计' })
  async getCoverageStats(@Query('year') year?: number) {
    const targetYear = year || this.getCurrentApplicationYear();

    const [
      totalSchools,
      schoolsWithPrompts,
      schoolsWithVerified,
      totalPrompts,
      pendingCount,
    ] = await Promise.all([
      this.prisma.school.count(),
      this.prisma.essayPrompt
        .groupBy({
          by: ['schoolId'],
          where: { year: targetYear, isActive: true },
        })
        .then((r) => r.length),
      this.prisma.essayPrompt
        .groupBy({
          by: ['schoolId'],
          where: { year: targetYear, isActive: true, status: 'VERIFIED' },
        })
        .then((r) => r.length),
      this.prisma.essayPrompt.count({
        where: { year: targetYear, isActive: true },
      }),
      this.prisma.essayPrompt.count({
        where: { year: targetYear, isActive: true, status: 'PENDING' },
      }),
    ]);

    return {
      year: targetYear,
      totalSchools,
      schoolsWithPrompts,
      schoolsWithVerified,
      coveragePercent:
        totalSchools > 0
          ? Math.round((schoolsWithVerified / totalSchools) * 100)
          : 0,
      totalPrompts,
      pendingReview: pendingCount,
    };
  }

  @Get('dashboard/freshness')
  @ApiOperation({ summary: '各校采集新鲜度' })
  async getFreshness() {
    return this.prisma.schoolEssaySource.findMany({
      where: { isActive: true },
      select: {
        id: true,
        sourceType: true,
        url: true,
        scrapeGroup: true,
        lastScrapedAt: true,
        lastStatus: true,
        lastError: true,
        school: {
          select: {
            id: true,
            name: true,
            nameZh: true,
            usNewsRank: true,
          },
        },
      },
      orderBy: { school: { usNewsRank: 'asc' } },
    });
  }

  @Get('dashboard/changes')
  @ApiOperation({ summary: '年度变化列表' })
  async getChanges(@Query('year') year?: number) {
    const targetYear = year || this.getCurrentApplicationYear();
    return this.prisma.essayPrompt.findMany({
      where: {
        year: targetYear,
        changeType: { in: ['MODIFIED', 'NEW'] },
        isActive: true,
      },
      include: {
        school: { select: { id: true, name: true, nameZh: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ============ Source URL Management ============

  @Get('sources')
  @ApiOperation({ summary: '列出所有采集源配置' })
  async listSources() {
    return this.prisma.schoolEssaySource.findMany({
      include: {
        school: {
          select: {
            id: true,
            name: true,
            nameZh: true,
            usNewsRank: true,
          },
        },
      },
      orderBy: { school: { usNewsRank: 'asc' } },
    });
  }

  @Post('sources')
  @ApiOperation({ summary: '添加采集源' })
  async addSource(@Body() dto: CreateSchoolEssaySourceDto) {
    return this.prisma.schoolEssaySource.create({
      data: {
        schoolId: dto.schoolId,
        sourceType: dto.sourceType,
        url: dto.url,
        slug: dto.slug,
        scrapeGroup: dto.scrapeGroup || 'GENERIC',
        priority: dto.priority || 0,
        scrapeConfig: dto.scrapeConfig || undefined,
      },
      include: {
        school: { select: { id: true, name: true, nameZh: true } },
      },
    });
  }

  @Put('sources/:id')
  @ApiOperation({ summary: '修改采集源' })
  async updateSource(
    @Param('id') id: string,
    @Body() dto: UpdateSchoolEssaySourceDto,
  ) {
    return this.prisma.schoolEssaySource.update({
      where: { id },
      data: dto,
      include: {
        school: { select: { id: true, name: true, nameZh: true } },
      },
    });
  }

  @Delete('sources/:id')
  @ApiOperation({ summary: '删除采集源' })
  async deleteSource(@Param('id') id: string) {
    return this.prisma.schoolEssaySource.delete({ where: { id } });
  }

  private getCurrentApplicationYear(): number {
    const now = new Date();
    const month = now.getMonth() + 1;
    return month >= 8 ? now.getFullYear() + 1 : now.getFullYear();
  }
}
