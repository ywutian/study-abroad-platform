import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, RequirePermission, Roles } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Permission } from '../../common/constants/permissions';
import {
  ThrottleRelaxed,
  ThrottleSensitive,
} from '../../common/decorators/throttle.decorator';
import { AdminSchoolDataCoverageService } from './admin-school-data-coverage.service';
import { CdsDiscoverDto, CdsExtractDto } from './dto/school-data-pipeline.dto';

@ApiTags('Admin CDS Pipeline')
@ApiBearerAuth()
@Controller('admin/cds')
@Roles(Role.OPERATOR)
export class AdminCdsPipelineController {
  constructor(private readonly coverage: AdminSchoolDataCoverageService) {}

  @Post('discover')
  @ThrottleRelaxed()
  @RequirePermission(Permission.DATA_HEALTH)
  @ApiOperation({
    summary:
      'Compatibility alias for /admin/schools/cds/discover. Return official CDS search queries for schools missing a prediction-critical field.',
  })
  async discoverCds(@Body() dto: CdsDiscoverDto) {
    return this.coverage.discoverCdsCandidates(dto);
  }

  @Post('extract')
  @ThrottleSensitive()
  @RequirePermission(Permission.SCHOOL_EDIT)
  @ApiOperation({
    summary:
      'Compatibility alias for /admin/schools/cds/extract. Commit reviewed CDS extraction rows through the audited bulk-update path.',
  })
  async extractCds(
    @Body() dto: CdsExtractDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.coverage.extractCdsRows(dto, user.id);
  }
}
