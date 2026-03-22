import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles, CurrentUser, RequirePermission } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Permission } from '../../common/constants/permissions';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import { HighSchoolService } from '../school/high-school.service';
import {
  CreateHighSchoolDto,
  UpdateHighSchoolDto,
  HighSchoolQueryDto,
  ApproveSuggestionDto,
  BatchImportHighSchoolDto,
} from './dto/high-school.dto';

@ApiTags('Admin High Schools')
@ApiBearerAuth()
@Controller('admin/high-schools')
@Roles(Role.OPERATOR)
@RequirePermission(Permission.HIGHSCHOOL_MANAGE)
export class AdminHighSchoolController {
  constructor(private readonly highSchoolService: HighSchoolService) {}

  @Get()
  @ThrottleRelaxed()
  @ApiOperation({ summary: 'List high schools with filters (admin)' })
  async list(@Query() query: HighSchoolQueryDto) {
    return this.highSchoolService.adminList(query);
  }

  @Get('review-needed')
  @ThrottleRelaxed()
  @ApiOperation({ summary: 'List schools needing re-evaluation' })
  async reviewNeeded() {
    return this.highSchoolService.getReviewNeeded();
  }

  @Get('suggestions')
  @ThrottleRelaxed()
  @ApiOperation({ summary: 'List user-submitted school suggestions' })
  async suggestions(@Query('status') status?: string) {
    return this.highSchoolService.listSuggestions(status);
  }

  @Get(':id')
  @ThrottleRelaxed()
  @ApiOperation({ summary: 'Get high school detail' })
  async detail(@Param('id') id: string) {
    return this.highSchoolService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new high school' })
  async create(
    @Body() dto: CreateHighSchoolDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.highSchoolService.create(dto, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update high school evaluation' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateHighSchoolDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.highSchoolService.update(id, dto, user.id);
  }

  @Post('batch-import')
  @ApiOperation({
    summary: 'Batch import high schools from scraped/curated data',
  })
  async batchImport(
    @Body() dto: BatchImportHighSchoolDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.highSchoolService.batchImport(dto.schools, user.id);
  }

  @Post('suggestions/:id/approve')
  @ApiOperation({ summary: 'Approve a school suggestion' })
  async approveSuggestion(
    @Param('id') id: string,
    @Body() dto: ApproveSuggestionDto,
  ) {
    return this.highSchoolService.approveSuggestion(
      id,
      dto.type,
      dto.mergeIntoId,
    );
  }

  @Post('suggestions/:id/reject')
  @ApiOperation({ summary: 'Reject a school suggestion' })
  async rejectSuggestion(@Param('id') id: string) {
    return this.highSchoolService.rejectSuggestion(id);
  }
}
