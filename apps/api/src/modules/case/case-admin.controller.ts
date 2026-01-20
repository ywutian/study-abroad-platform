import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CaseService } from './case.service';
import {
  BatchImportCaseDto,
  ReviewCaseEssayDto,
  BatchVerifyCaseDto,
} from './dto/batch-import-case.dto';
import { Roles, CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Role } from '@prisma/client';

@ApiTags('admin/cases')
@ApiBearerAuth()
@Controller('admin/cases')
@Roles(Role.ADMIN)
export class CaseAdminController {
  constructor(private readonly caseService: CaseService) {}

  @Get('stats')
  @ApiOperation({ summary: '获取案例管理统计' })
  async getAdminStats() {
    return this.caseService.getAdminStats();
  }

  @Get('pending-essays')
  @ApiOperation({ summary: '获取待审核的用户提交文书' })
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
  @ApiOperation({ summary: '批量导入案例' })
  async batchImport(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BatchImportCaseDto,
  ) {
    return this.caseService.batchImport(dto, user.id);
  }

  @Post(':id/review-essay')
  @ApiOperation({ summary: '审核用户提交的文书' })
  async reviewEssay(@Param('id') id: string, @Body() dto: ReviewCaseEssayDto) {
    return this.caseService.reviewCaseEssay(id, dto);
  }

  @Post('batch-verify')
  @ApiOperation({ summary: '批量审核案例' })
  async batchVerify(@Body() dto: BatchVerifyCaseDto) {
    return this.caseService.batchVerifyCases(dto);
  }
}
