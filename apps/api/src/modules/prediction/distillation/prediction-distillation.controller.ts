import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../../common/decorators';
import { DistillationStatsRollupService } from './distillation-stats-rollup.service';
import {
  BackfillCaseAggregatesDto,
  BackfillDistillationRollupsDto,
  LoadCdsBandsDto,
  LoadCdsBandsFixtureDto,
} from './distillation.dto';
import { CdsBandsIngestionService } from './cds-bands-ingestion.service';
import { CaseAggregateBackfillService } from './case-aggregate-backfill.service';
import { CDS_BANDS_BUNDLED_FIXTURE } from './cds-bands-fixture';

@ApiTags('admin/predictions/distillation')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/predictions/distillation')
export class PredictionDistillationController {
  constructor(
    private readonly rollups: DistillationStatsRollupService,
    private readonly cdsBandsIngestion: CdsBandsIngestionService,
    private readonly caseAggregateBackfill: CaseAggregateBackfillService,
  ) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get compliant distillation overview and China cohort live gates',
  })
  async getOverview(@Query('days') days?: string) {
    return this.rollups.getOverview(days ? Number(days) : undefined);
  }

  @Get('daily')
  @ApiOperation({ summary: 'Get compliant distillation daily aggregates' })
  async getDaily(
    @Query('days') days?: string,
    @Query('stage') stage?: string,
    @Query('teacherKey') teacherKey?: string,
    @Query('cohortKey') cohortKey?: string,
  ) {
    return this.rollups.getDailyStats({
      days: days ? Number(days) : undefined,
      stage,
      teacherKey,
      cohortKey,
    });
  }

  @Get('schools')
  @ApiOperation({ summary: 'Get compliant distillation school aggregates' })
  async getSchools(
    @Query('date') date?: string,
    @Query('stage') stage?: string,
    @Query('cohortKey') cohortKey?: string,
    @Query('coverageTier')
    coverageTier?: 'NONE' | 'BASELINE_ONLY' | 'CN_ENHANCED',
    @Query('limit') limit?: string,
  ) {
    return this.rollups.getSchoolStats({
      date,
      stage,
      cohortKey,
      coverageTier,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('raw')
  @ApiOperation({ summary: 'Get raw compliant distillation observations' })
  async getRaw(
    @Query('stage') stage?: string,
    @Query('cohortKey') cohortKey?: string,
    @Query('schoolId') schoolId?: string,
    @Query('sourceName') sourceName?: string,
    @Query('limit') limit?: string,
  ) {
    return this.rollups.getRawObservations({
      stage,
      cohortKey,
      schoolId,
      sourceName,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('rollups/backfill')
  @ApiOperation({
    summary: 'Backfill compliant distillation rollups for a date window',
  })
  async backfill(@Body() body: BackfillDistillationRollupsDto) {
    const endDate = body.endDate ? new Date(body.endDate) : new Date();
    const startDate = body.startDate
      ? new Date(body.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    return this.rollups.recomputeWindow({
      startDate,
      endDate,
      schoolId: body.schoolId,
      cohortKey: body.cohortKey,
    });
  }

  @Post('cds-bands/load')
  @ApiOperation({
    summary: 'Load curated CDS admit-band rows for the CDS Bands teacher',
  })
  async loadCdsBands(@Body() body: LoadCdsBandsDto) {
    return this.cdsBandsIngestion.ingestRows(body.rows, {
      dryRun: body.dryRun ?? true,
    });
  }

  @Post('cds-bands/load-fixture')
  @ApiOperation({
    summary:
      'Load the CDS Bands teacher with the bundled starter fixture (handful of UC schools). Same idempotent semantics as cds-bands/load. For larger CDS sets, POST /cds-bands/load with custom rows[].',
  })
  async loadCdsBandsFixture(@Body() body: LoadCdsBandsFixtureDto) {
    return this.cdsBandsIngestion.ingestRows(CDS_BANDS_BUNDLED_FIXTURE, {
      dryRun: body.dryRun ?? true,
    });
  }

  @Post('case-aggregates/backfill')
  @ApiOperation({
    summary:
      'Backfill case-aggregate teachers (ap-rigor / ib / feeder-hs / activity-intensity) from approved AdmissionCase rows. Idempotent per setVersion.',
  })
  async backfillCaseAggregates(@Body() body: BackfillCaseAggregatesDto) {
    return this.caseAggregateBackfill.runBackfill({
      dryRun: body.dryRun ?? true,
      minSamples: body.minSamples,
      setVersion: body.setVersion,
    });
  }
}
