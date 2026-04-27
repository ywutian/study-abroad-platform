import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  forwardRef,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../../common/decorators';
import { ThrottleRelaxed } from '../../../common/decorators/throttle.decorator';
import { DistillationStatsRollupService } from './distillation-stats-rollup.service';
import {
  BackfillCaseAggregatesDto,
  BackfillDistillationRollupsDto,
  CounselorBackfillDto,
  ListCdsBandRowsDto,
  LoadCdsBandsDto,
  LoadCdsBandsFixtureDto,
  PreviewPredictionDto,
  UpdateCdsBandRowDto,
} from './distillation.dto';
import { CdsBandsIngestionService } from './cds-bands-ingestion.service';
import { CaseAggregateBackfillService } from './case-aggregate-backfill.service';
import { CDS_BANDS_BUNDLED_FIXTURE } from './cds-bands-fixture';
import { PredictionService } from '../prediction.service';
import { CounselorBackfillService } from '../counselor/counselor-backfill.service';
import type { ProfileInput } from '../prediction.prompts';

@ApiTags('admin/predictions/distillation')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/predictions/distillation')
export class PredictionDistillationController {
  constructor(
    private readonly rollups: DistillationStatsRollupService,
    private readonly cdsBandsIngestion: CdsBandsIngestionService,
    private readonly caseAggregateBackfill: CaseAggregateBackfillService,
    @Inject(forwardRef(() => PredictionService))
    private readonly predictionService: PredictionService,
    private readonly counselorBackfill: CounselorBackfillService,
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

  @Get('cds-bands/coverage')
  @ApiOperation({
    summary:
      'Get SchoolCdsAdmitBand coverage by school for Tier 1 counselor anchors.',
  })
  async getCdsBandsCoverage() {
    return this.cdsBandsIngestion.getCoverage();
  }

  @Get('cds-bands/rows')
  @ApiOperation({
    summary:
      'List raw SchoolCdsAdmitBand rows for admin review and manual correction.',
  })
  async listCdsBandRows(@Query() query: ListCdsBandRowsDto) {
    return this.cdsBandsIngestion.listRows(query);
  }

  @Patch('cds-bands/rows/:id')
  @ApiOperation({
    summary:
      'Update one SchoolCdsAdmitBand row after manual source verification.',
  })
  async updateCdsBandRow(
    @Param('id') id: string,
    @Body() body: UpdateCdsBandRowDto,
  ) {
    return this.cdsBandsIngestion.updateRow(id, body);
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

  @Post('dry-run')
  @ThrottleRelaxed()
  @ApiOperation({
    summary:
      'Run a synthetic prediction with shadow-distillation enabled. Returns full servedTrace.distillation per school so admins can verify which teachers fire for a given mock profile. Read-only — no DB writes, no charging.',
  })
  async dryRunPrediction(@Body() body: PreviewPredictionDto) {
    // The DTO whitelists a subset of ProfileInput fields. previewPredict()
    // expects a fully-typed ProfileInput, so we cast — `whitelist: true`
    // on the global ValidationPipe ensures no unexpected fields slip
    // through; missing optional fields are handled inside the engines.
    const profileInput = {
      ...(body.profile as Partial<ProfileInput>),
      // Coerce to the runtime-required arrays even when omitted.
      testScores: body.profile.testScores ?? [],
      activities: body.profile.activities ?? [],
      awards: body.profile.awards ?? [],
    } as ProfileInput;

    return this.predictionService.previewPredict(profileInput, body.schoolIds, {
      locale: body.locale ?? 'en',
      includeShadowDistillation: true,
      includeServedTrace: true,
      applicationRound: body.applicationRound,
      counselorMode: body.engine === 'counselor' || body.engine === 'both',
    });
  }

  @Post('backfill-counselor')
  @ThrottleRelaxed()
  @ApiOperation({
    summary:
      'Rewrite stored PredictionResult rows to use counselor engine (PR-7). ' +
      'Idempotent — re-runs skip rows already on counselor unless forceRecompute. ' +
      'Tier-4 (insufficient data) rows are skipped (existing fusion result preserved). ' +
      'On non-dry runs, also flushes Redis prediction cache so users see fresh numbers.',
  })
  async backfillCounselor(@Body() body: CounselorBackfillDto) {
    return this.counselorBackfill.runBackfill({
      dryRun: body.dryRun ?? true,
      batchSize: body.batchSize,
      cursor: body.cursor ?? null,
      forceRecompute: body.forceRecompute,
      skipCacheFlush: body.skipCacheFlush,
    });
  }
}
