import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { HighSchoolService } from './high-school.service';
import { HighSchoolType } from '@prisma/client';

@ApiTags('High Schools')
@Controller('high-schools')
export class HighSchoolController {
  constructor(private readonly highSchoolService: HighSchoolService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '搜索高中参考数据' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'type', required: false, enum: HighSchoolType })
  @ApiQuery({ name: 'tier', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async search(
    @Query('search') search?: string,
    @Query('country') country?: string,
    @Query('type') type?: HighSchoolType,
    @Query('tier') tier?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.highSchoolService.search({
      search,
      country,
      type,
      tier: tier ? parseInt(tier, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }
}
