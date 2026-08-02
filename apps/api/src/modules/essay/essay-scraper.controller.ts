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
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSchoolEssaySourceDto,
  UpdateSchoolEssaySourceDto,
  TestScrapeDto,
  ConfirmSaveDto,
} from './dto/school-essay-source.dto';
import {
  ScrapeSchoolDto,
  StartPipelineDto,
} from './dto/essay-scraper-pipeline.dto';

@ApiTags('admin/essay-scraper')
@ApiBearerAuth()
@ThrottleRelaxed()
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
  @ApiOperation({ summary: 'Get list of scrapeable schools' })
  async getConfiguredSchools() {
    return {
      schools: await this.scraperService.getConfiguredSchools(),
    };
  }

  @Post('scrape')
  @ApiOperation({ summary: 'Scrape essay prompts for a single school' })
  async scrapeSchool(@Body() body: ScrapeSchoolDto) {
    const { schoolName, year, sources } = body;
    return this.scraperService.scrapeSchool(schoolName, year, sources);
  }

  @Post('scrape-all')
  @ApiOperation({ summary: 'Scrape essay prompts for all configured schools' })
  async scrapeAllSchools(@Query('year') year?: number) {
    return this.scraperService.scrapeAllSchools(year);
  }

  // ============ Test Scrape (Preview) ============

  @Post('test-scrape')
  @ApiOperation({ summary: 'Test scrape (preview, does not write to DB)' })
  async testScrape(@Body() dto: TestScrapeDto) {
    return this.scraperService.testScrapeSchool(dto.schoolName, dto.year);
  }

  @Post('confirm-save')
  @ApiOperation({ summary: 'Confirm and save test scrape results' })
  async confirmSave(@Body() dto: ConfirmSaveDto) {
    const saved = await this.scraperService.confirmSave(
      dto.data,
      dto.selectedIndices,
    );
    return { saved };
  }

  // ============ Pipeline Management ============

  @Post('pipeline/start')
  @ApiOperation({ summary: 'Manually start full scraping pipeline' })
  async startPipeline(
    @CurrentUser() user: CurrentUserPayload,
    @Body() _body: StartPipelineDto,
  ) {
    const runId = await this.scheduler.runPipeline('MANUAL', user.id);
    return { runId, status: 'RUNNING' };
  }

  @Get('pipeline/runs')
  @ApiOperation({ summary: 'Get pipeline run history' })
  async listPipelineRuns(@Query('limit') limit?: number) {
    // governance: admin-scope — whole controller is @Roles(Role.ADMIN) — scraper pipeline operations
    return this.prisma.essayPipelineRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit || 10,
    });
  }

  @Get('pipeline/:runId')
  @ApiOperation({ summary: 'Get pipeline run status' })
  async getPipelineStatus(@Param('runId') runId: string) {
    // governance: admin-scope — whole controller is @Roles(Role.ADMIN) — scraper pipeline operations
    return this.prisma.essayPipelineRun.findUnique({
      where: { id: runId },
    });
  }

  // ============ Dashboard ============

  @Get('dashboard/coverage')
  @ApiOperation({ summary: 'Get essay prompt coverage statistics' })
  async getCoverageStats(@Query('year') year?: number) {
    const targetYear = year || this.getCurrentApplicationYear();

    const [
      totalSchools,
      schoolsWithPrompts,
      schoolsWithVerified,
      totalPrompts,
      pendingCount,
    ] = await Promise.all([
      // governance: admin-scope — whole controller is @Roles(Role.ADMIN) — scraper pipeline operations
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
      // governance: admin-scope — whole controller is @Roles(Role.ADMIN) — scraper pipeline operations
      this.prisma.essayPrompt.count({
        where: { year: targetYear, isActive: true },
      }),
      // governance: admin-scope — whole controller is @Roles(Role.ADMIN) — scraper pipeline operations
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
  @ApiOperation({ summary: 'Get scrape freshness by school' })
  async getFreshness() {
    // governance: admin-scope — whole controller is @Roles(Role.ADMIN) — scraper pipeline operations
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
  @ApiOperation({ summary: 'Get annual changes list' })
  async getChanges(@Query('year') year?: number) {
    const targetYear = year || this.getCurrentApplicationYear();
    // governance: admin-scope — whole controller is @Roles(Role.ADMIN) — scraper pipeline operations
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
  @ApiOperation({ summary: 'List all scrape source configurations' })
  async listSources() {
    // governance: admin-scope — whole controller is @Roles(Role.ADMIN) — scraper pipeline operations
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
  @ApiOperation({ summary: 'Add scrape source' })
  async addSource(@Body() dto: CreateSchoolEssaySourceDto) {
    // governance: admin-scope — whole controller is @Roles(Role.ADMIN) — scraper pipeline operations
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
  @ApiOperation({ summary: 'Update scrape source' })
  async updateSource(
    @Param('id') id: string,
    @Body() dto: UpdateSchoolEssaySourceDto,
  ) {
    // governance: admin-scope — whole controller is @Roles(Role.ADMIN) — scraper pipeline operations
    return this.prisma.schoolEssaySource.update({
      where: { id },
      data: dto,
      include: {
        school: { select: { id: true, name: true, nameZh: true } },
      },
    });
  }

  @Delete('sources/:id')
  @ApiOperation({ summary: 'Delete scrape source' })
  async deleteSource(@Param('id') id: string) {
    // governance: admin-scope — whole controller is @Roles(Role.ADMIN) — scraper pipeline operations
    return this.prisma.schoolEssaySource.delete({ where: { id } });
  }

  private getCurrentApplicationYear(): number {
    const now = new Date();
    const month = now.getMonth() + 1;
    return month >= 8 ? now.getFullYear() + 1 : now.getFullYear();
  }
}
