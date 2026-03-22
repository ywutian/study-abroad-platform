import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CaseService } from './case.service';
import {
  BatchImportCaseDto,
  ReviewCaseEssayDto,
  BatchVerifyCaseDto,
} from './dto/batch-import-case.dto';
import { AdminReviewService } from '../admin/admin-review.service';
import { Roles, CurrentUser, RequirePermission } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Role } from '@prisma/client';
import { Permission } from '../../common/constants/permissions';
import {
  ThrottleRelaxed,
  ThrottleSensitive,
} from '../../common/decorators/throttle.decorator';

@ApiTags('admin/cases')
@ApiBearerAuth()
@ThrottleRelaxed()
@Controller('admin/cases')
@Roles(Role.OPERATOR)
@RequirePermission(Permission.CASE_REVIEW)
export class CaseAdminController {
  constructor(
    private readonly caseService: CaseService,
    private readonly adminReviewService: AdminReviewService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get case management statistics' })
  async getAdminStats() {
    return this.caseService.getAdminStats();
  }

  @Get('pending-essays')
  @ApiOperation({ summary: 'Get pending user-submitted essays for review' })
  async getPendingEssays(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.caseService.getPendingEssays(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Post('batch-import')
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Batch import cases' })
  async batchImport(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BatchImportCaseDto,
  ) {
    return this.caseService.batchImport(dto, user.id);
  }

  @Post(':id/review-essay')
  @ApiOperation({ summary: 'Review user-submitted essay' })
  async reviewEssay(@Param('id') id: string, @Body() dto: ReviewCaseEssayDto) {
    return this.caseService.reviewCaseEssay(id, dto);
  }

  @Post('batch-verify')
  @ApiOperation({ summary: 'Batch verify cases' })
  async batchVerify(@Body() dto: BatchVerifyCaseDto) {
    return this.caseService.batchVerifyCases(dto);
  }

  @Get('batch-history')
  @ApiOperation({ summary: 'Get import batch history' })
  async getBatchHistory(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.caseService.getBatchHistory(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('batch/:batchId/progress')
  @ApiOperation({ summary: 'Get import progress for a batch' })
  async getImportProgress(@Param('batchId') batchId: string) {
    return this.caseService.getImportProgress(batchId);
  }

  @Delete('batch/:batchId')
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Rollback a batch import (soft delete)' })
  async rollbackBatch(
    @Param('batchId') batchId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.adminReviewService.rollbackBatch(batchId, user.id);
  }
}
