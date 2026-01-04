import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SchoolService } from './school.service';
import { SchoolDataService } from './school-data.service';
import { SchoolScraperService } from './school-scraper.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Public, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '@prisma/client';

@ApiTags('schools')
@Controller('schools')
export class SchoolController {
  constructor(
    private readonly schoolService: SchoolService,
    private readonly schoolDataService: SchoolDataService,
    private readonly schoolScraperService: SchoolScraperService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all schools' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('country') country?: string,
    @Query('search') search?: string
  ) {
    return this.schoolService.findAll(pagination, { country, search });
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get school by ID' })
  async findById(@Param('id') id: string) {
    return this.schoolService.findById(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create school (admin only)' })
  async create(@Body() data: Record<string, unknown>) {
    return this.schoolService.create(data as any);
  }

  @Put(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update school (admin only)' })
  async update(@Param('id') id: string, @Body() data: Record<string, unknown>) {
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
  @ApiOperation({ summary: 'Sync schools from College Scorecard API (admin only)' })
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
  @ApiOperation({ summary: 'Scrape admission info from school websites (admin only)' })
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

