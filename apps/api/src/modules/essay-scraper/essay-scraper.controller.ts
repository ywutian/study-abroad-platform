import { Controller, Post, Get, Query, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EssayScraperService } from './essay-scraper.service';
import { Roles } from '../../common/decorators';
import { Role } from '@prisma/client';
import { SourceType } from '../../common/types/enums';

@ApiTags('admin/essay-scraper')
@ApiBearerAuth()
@Controller('admin/essay-scraper')
@Roles(Role.ADMIN)
export class EssayScraperController {
  constructor(private readonly scraperService: EssayScraperService) {}

  @Get('schools')
  @ApiOperation({ summary: '获取可爬取的学校列表' })
  getConfiguredSchools() {
    return {
      schools: this.scraperService.getConfiguredSchools(),
    };
  }

  @Post('scrape')
  @ApiOperation({ summary: '爬取单个学校的文书题目' })
  async scrapeSchool(
    @Body() body: { schoolName: string; year?: number; sources?: SourceType[] },
  ) {
    const { schoolName, year, sources } = body;
    return this.scraperService.scrapeSchool(schoolName, year, sources);
  }

  @Post('scrape-all')
  @ApiOperation({ summary: '爬取所有配置学校的文书题目' })
  async scrapeAllSchools(@Query('year') year?: number) {
    return this.scraperService.scrapeAllSchools(year);
  }
}
