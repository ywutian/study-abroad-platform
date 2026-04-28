import { Body, Controller, Get, Post, Query } from '@nestjs/common';
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
import {
  CdsDiscoverDto,
  CdsExtractDto,
  HeuristicFillDto,
  ImportIpedsCsvDto,
  SchoolDataCoverageQueryDto,
  SyncIpedsAdmissionsDto,
} from './dto/school-data-pipeline.dto';

@ApiTags('Admin School Data Pipeline')
@ApiBearerAuth()
@Controller('admin/schools')
@Roles(Role.OPERATOR)
export class AdminSchoolDataPipelineController {
  constructor(private readonly coverage: AdminSchoolDataCoverageService) {}

  @Get('data-coverage')
  @ThrottleRelaxed()
  @RequirePermission(Permission.DATA_HEALTH)
  @ApiOperation({
    summary:
      'PR-15 coverage matrix for prediction-critical school data, using School.metadata.provenance.',
  })
  async getDataCoverage(@Query() query: SchoolDataCoverageQueryDto) {
    return this.coverage.getCoverage({
      includeAllCountries: query.includeAllCountries,
    });
  }

  @Post('sync/ipeds-admissions')
  @ThrottleSensitive()
  @RequirePermission(Permission.DATA_SYNC)
  @ApiOperation({
    summary:
      'Run the Urban Institute/IPEDS admissions sync for overall admit-rate fields.',
  })
  async syncIpedsAdmissions(
    @Body() dto: SyncIpedsAdmissionsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.coverage.syncIpedsAdmissions(dto, user.id);
  }

  @Post('import/ipeds-csv')
  @ThrottleSensitive()
  @RequirePermission(Permission.SCHOOL_EDIT)
  @ApiOperation({
    summary:
      'Import parsed IPEDS CSV rows by UNITID, routing writes through the bulk update/provenance path.',
  })
  async importIpedsCsv(
    @Body() dto: ImportIpedsCsvDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.coverage.importIpedsCsvRows(dto, user.id);
  }

  @Post('cds/discover')
  @ThrottleRelaxed()
  @RequirePermission(Permission.DATA_HEALTH)
  @ApiOperation({
    summary:
      'Return official CDS search queries for schools missing a prediction-critical field.',
  })
  async discoverCds(@Body() dto: CdsDiscoverDto) {
    return this.coverage.discoverCdsCandidates(dto);
  }

  @Post('cds/extract')
  @ThrottleSensitive()
  @RequirePermission(Permission.SCHOOL_EDIT)
  @ApiOperation({
    summary:
      'Commit reviewed CDS extraction rows through the same audited bulk-update path.',
  })
  async extractCds(
    @Body() dto: CdsExtractDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.coverage.extractCdsRows(dto, user.id);
  }

  @Post('heuristic-fill')
  @ThrottleSensitive()
  @RequirePermission(Permission.SCHOOL_EDIT)
  @ApiOperation({
    summary:
      'Fill remaining prediction-critical gaps with explicitly low-confidence HEURISTIC provenance.',
  })
  async heuristicFill(
    @Body() dto: HeuristicFillDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.coverage.heuristicFill(dto, user.id);
  }
}
