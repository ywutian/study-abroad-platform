import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles, RequirePermission, CurrentUser } from '../../common/decorators';
import { Permission } from '../../common/constants/permissions';
import { AdminReviewService } from './admin-review.service';
import {
  ReviewApproveDto,
  ReviewRejectDto,
  ReviewEditAndApproveDto,
  ReviewBatchDto,
  ReviewQueueQueryDto,
} from './dto';

@ApiTags('Admin Review')
@ApiBearerAuth()
@Controller('admin/review')
@Roles(Role.OPERATOR)
@RequirePermission(Permission.CASE_REVIEW)
export class AdminReviewController {
  constructor(private readonly reviewService: AdminReviewService) {}

  @Get('queue')
  @ApiOperation({ summary: 'Get staging review queue' })
  async getQueue(@Query() query: ReviewQueueQueryDto) {
    return this.reviewService.getReviewQueue(query);
  }

  @Get('pending-cases')
  @ApiOperation({ summary: 'Get pending-review cases' })
  async getPendingCases(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewService.getPendingCases(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get review statistics' })
  async getStats() {
    return this.reviewService.getReviewStats();
  }

  // --- Staging item actions ---

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a staging item' })
  async approveStaging(
    @Param('id') id: string,
    @Body() dto: ReviewApproveDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.reviewService.approveStagingItem(id, user.id, dto.note);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a staging item' })
  async rejectStaging(
    @Param('id') id: string,
    @Body() dto: ReviewRejectDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.reviewService.rejectStagingItem(id, user.id, dto.reason);
  }

  @Post(':id/edit-and-approve')
  @ApiOperation({ summary: 'Edit and approve a staging item' })
  async editAndApprove(
    @Param('id') id: string,
    @Body() dto: ReviewEditAndApproveDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.reviewService.editAndApproveStagingItem(
      id,
      user.id,
      dto.correctedData ? { ...dto.correctedData } : {},
      dto.note,
    );
  }

  // --- Pending case actions ---

  @Post('cases/:id/approve')
  @ApiOperation({ summary: 'Approve a pending-review case' })
  async approvePendingCase(
    @Param('id') id: string,
    @Body() dto: ReviewApproveDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.reviewService.approvePendingCase(id, user.id, dto.note);
  }

  @Post('cases/:id/reject')
  @ApiOperation({ summary: 'Reject a pending-review case' })
  async rejectPendingCase(
    @Param('id') id: string,
    @Body() dto: ReviewRejectDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.reviewService.rejectPendingCase(id, user.id, dto.reason);
  }

  // --- Batch operations ---

  @Post('batch')
  @ApiOperation({ summary: 'Batch approve/reject staging items' })
  async batchReview(
    @Body() dto: ReviewBatchDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.reviewService.batchReview(
      dto.ids,
      dto.action,
      user.id,
      dto.reason,
    );
  }

  // --- Import batches ---

  @Get('batches')
  @ApiOperation({ summary: 'List import batches' })
  async getImportBatches(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewService.getImportBatches(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Post('batches/:batchId/rollback')
  @ApiOperation({ summary: 'Rollback an import batch' })
  @RequirePermission(Permission.CASE_DELETE)
  async rollbackBatch(
    @Param('batchId') batchId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.reviewService.rollbackBatch(batchId, user.id);
  }
}
