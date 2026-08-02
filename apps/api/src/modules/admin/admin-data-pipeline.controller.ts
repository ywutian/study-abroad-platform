import { Controller, Get, Put, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles, RequirePermission, CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Permission } from '../../common/constants/permissions';
import { Role } from '@prisma/client';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import { AdminReviewService } from './admin-review.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MaxLength } from 'class-validator';

class UpdateImportPolicyDto {
  @ApiProperty({ description: 'Auto-approve threshold (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  autoApproveThreshold?: number;

  @ApiProperty({ description: 'Pending review threshold (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pendingReviewThreshold?: number;

  @ApiProperty({ description: 'Minimum quality to accept (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minQuality?: number;
}

@ApiTags('Admin - Data Pipeline')
@ApiBearerAuth()
@Controller('admin/data-pipeline')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminDataPipelineController {
  constructor(
    private readonly reviewService: AdminReviewService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get data pipeline statistics' })
  @ThrottleRelaxed()
  @RequirePermission(Permission.DATA_HEALTH)
  async getPipelineStats(@CurrentUser() admin: CurrentUserPayload) {
    const reviewStats = await this.reviewService.getReviewStats();

    const sourceCounts = await this.prisma.admissionCase.groupBy({
      by: ['source'],
      _count: true,
    });

    const sourceMap = Object.fromEntries(
      sourceCounts.map((s) => [s.source ?? 'unknown', s._count]),
    );

    return {
      ...reviewStats,
      sources: sourceMap,
    };
  }

  @Get('policy')
  @ApiOperation({ summary: 'Get current import policy' })
  @ThrottleRelaxed()
  @RequirePermission(Permission.DATA_HEALTH)
  async getImportPolicy() {
    // governance: admin-scope — every controller in apps/api/src/modules/admin carries a class-level @Roles(OPERATOR | ADMIN | SUPER_ADMIN) with no @Public() and no method-level widening; AdminReviewService is additionally reached from case-admin.controller, which is @Roles(OPERATOR) + @RequirePermission(CASE_REVIEW). Operating across every user IS the admin surface
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'import_policy' },
    });

    return (
      setting?.value ?? {
        autoApproveThreshold: 80,
        pendingReviewThreshold: 50,
        minQuality: 0,
      }
    );
  }

  @Put('policy')
  @ApiOperation({ summary: 'Update import policy (SUPER_ADMIN only)' })
  @Roles(Role.SUPER_ADMIN)
  async updateImportPolicy(
    @CurrentUser() admin: CurrentUserPayload,
    @Body() dto: UpdateImportPolicyDto,
  ) {
    const current = (await this.getImportPolicy()) as Record<string, unknown>;
    const merged = { ...current, ...dto };

    // governance: admin-scope — every controller in apps/api/src/modules/admin carries a class-level @Roles(OPERATOR | ADMIN | SUPER_ADMIN) with no @Public() and no method-level widening; AdminReviewService is additionally reached from case-admin.controller, which is @Roles(OPERATOR) + @RequirePermission(CASE_REVIEW). Operating across every user IS the admin surface
    await this.prisma.systemSetting.upsert({
      where: { key: 'import_policy' },
      create: {
        key: 'import_policy',
        value: merged as any,
      },
      update: {
        value: merged as any,
      },
    });

    return merged;
  }
}
