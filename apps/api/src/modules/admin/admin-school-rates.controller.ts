import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles, CurrentUser, RequirePermission } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Permission } from '../../common/constants/permissions';
import { ThrottleSensitive } from '../../common/decorators/throttle.decorator';
import { AdminSchoolRatesService } from './admin-school-rates.service';
import { BulkUpdateSchoolRatesDto } from './dto/bulk-update-school-rates.dto';

/**
 * Admin endpoint for bulk-updating per-school admit rates from real data sources.
 *
 * Powers PR-13 (IPEDS importer) and PR-14 (top-30 CDS PDF refinement). Each call
 * carries provenance (source + sourceUrl + cycleYear) so AuditLog row reflects
 * who-pushed-what-from-where.
 *
 * Permission: SCHOOL_EDIT (existing). Sensitive throttle (5/min) since this
 * mutates 234+ schools in one request.
 */
@ApiTags('Admin School Rates')
@ApiBearerAuth()
@Controller('admin/schools')
@Roles(Role.OPERATOR)
@RequirePermission(Permission.SCHOOL_EDIT)
export class AdminSchoolRatesController {
  constructor(private readonly adminSchoolRates: AdminSchoolRatesService) {}

  @Post('bulk-update-acceptance-rates')
  @ThrottleSensitive()
  @ApiOperation({
    summary:
      'Bulk-update per-school admit rates (acceptanceRate, intlAcceptanceRate, transferAcceptanceRate, needBlindInternational). Idempotent + audit-logged. dryRun:true validates without writing.',
  })
  async bulkUpdate(
    @Body() dto: BulkUpdateSchoolRatesDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.adminSchoolRates.runBulkUpdate(dto, user.id);
  }
}
