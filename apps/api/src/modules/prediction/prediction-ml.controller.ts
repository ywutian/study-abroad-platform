/**
 * ML Prediction Admin Controller
 *
 * Admin-only endpoints for model training, management, monitoring, and fairness auditing.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators';
import { Role } from '@prisma/client';
import { ModelTrainerService } from './ml/model-trainer.service';
import { ModelRegistryService } from './ml/model-registry.service';
import { TrainingDataService } from './ml/training-data.service';
import { ShadowEvaluatorService } from './ml/shadow-evaluator.service';
import { ModelMonitorService } from './ml/model-monitor.service';
import { DiagnosticIngestService } from './diagnostic-ingest.service';
import { DiagIngestCasesDto } from './diagnostic-ingest.dto';

@ApiTags('admin/predictions')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/predictions')
export class PredictionMlController {
  constructor(
    private readonly trainer: ModelTrainerService,
    private readonly registry: ModelRegistryService,
    private readonly trainingData: TrainingDataService,
    private readonly shadow: ShadowEvaluatorService,
    private readonly monitor: ModelMonitorService,
    private readonly diagnosticIngest: DiagnosticIngestService,
  ) {}

  // ============================================
  // Diagnostic: real-case CSV ingest
  // ============================================

  @Post('diag/ingest-cases')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Ingest verified real admission cases from a CSV (used by admin UI + diag CLI). Use dryRun=true to preview.',
  })
  async diagIngestCases(@Body() body: DiagIngestCasesDto) {
    const csv = body?.csv;
    if (!csv || typeof csv !== 'string') {
      throw new BadRequestException(
        'Request body must include { csv: string }',
      );
    }
    if (csv.length > 5 * 1024 * 1024) {
      throw new BadRequestException('CSV too large (limit 5MB)');
    }
    try {
      return await this.diagnosticIngest.ingestRealCases({
        csvContent: csv,
        dryRun: body?.dryRun ?? false,
      });
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : String(e));
    }
  }

  @Get('diag/real-cases-template')
  @ApiOperation({
    summary:
      'Download CSV column template for real-case ingest (same file as apps/api/data/real-cases-template.csv).',
  })
  getRealCasesTemplate(): string {
    const filePath = path.join(
      process.cwd(),
      'data',
      'real-cases-template.csv',
    );
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Template not found: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  // ============================================
  // Training
  // ============================================

  @Post('train')
  @ApiOperation({ summary: 'Trigger ML model training' })
  async trainModel() {
    return this.trainer.trainModel();
  }

  @Get('training-stats')
  @ApiOperation({ summary: 'Get training data stats (counts, tier, balance)' })
  async getTrainingStats() {
    return this.trainingData.getDatasetStats();
  }

  // ============================================
  // Model Management
  // ============================================

  @Get('models')
  @ApiOperation({ summary: 'List all model versions' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'tier', required: false })
  @ApiQuery({ name: 'band', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listModels(
    @Query('status') status?: string,
    @Query('tier') tier?: string,
    @Query('band') band?: string,
    @Query('limit') limit?: string,
  ) {
    return this.registry.listModels({
      status: status as any,
      tier: tier != null ? Number(tier) : undefined,
      selectivityBand: band,
      limit: limit != null ? Number(limit) : undefined,
    });
  }

  @Get('models/:id')
  @ApiOperation({ summary: 'Get single model details' })
  async getModel(@Param('id') id: string) {
    return this.registry.getModel(id);
  }

  @Post('models/:id/promote-shadow')
  @ApiOperation({ summary: 'Promote CANDIDATE → SHADOW' })
  async promoteToShadow(@Param('id') id: string) {
    await this.registry.promoteToShadow(id);
    return { success: true, message: 'Model promoted to SHADOW' };
  }

  @Post('models/:id/promote-champion')
  @ApiOperation({ summary: 'Promote CANDIDATE/SHADOW → CHAMPION' })
  async promoteToChampion(@Param('id') id: string) {
    await this.registry.promoteToChampion(id);
    return { success: true, message: 'Model promoted to CHAMPION' };
  }

  @Post('models/rollback')
  @ApiOperation({ summary: 'Rollback to previous champion' })
  @ApiQuery({ name: 'band', required: false })
  async rollback(@Query('band') band?: string) {
    await this.registry.rollback(band ?? null);
    return { success: true, message: 'Rolled back to previous champion' };
  }

  @Get('models/compare')
  @ApiOperation({ summary: 'Side-by-side model comparison' })
  @ApiQuery({ name: 'a', required: true })
  @ApiQuery({ name: 'b', required: true })
  async compareModels(@Query('a') a: string, @Query('b') b: string) {
    return this.registry.compareModels(a, b);
  }

  // ============================================
  // Monitoring
  // ============================================

  @Get('shadow-report')
  @ApiOperation({ summary: 'Get shadow model A/B test results' })
  @ApiQuery({ name: 'band', required: false })
  async getShadowReport(@Query('band') band?: string) {
    return this.shadow.getShadowReport(band ?? null);
  }

  @Get('monitor')
  @ApiOperation({
    summary: 'Get latest monitoring report (drift, calibration, data growth)',
  })
  async getMonitorReport() {
    const report = await this.monitor.getLatestReport();
    if (report) return report;
    // No cached report — run fresh checks
    return this.monitor.runChecksNow();
  }

  @Post('monitor/run')
  @ApiOperation({ summary: 'Run monitoring checks now' })
  async runMonitor() {
    return this.monitor.runChecksNow();
  }

  // ============================================
  // Data Quality
  // ============================================

  @Get('data-quality')
  @ApiOperation({ summary: 'Full dataset validation report' })
  async getDataQuality() {
    const dataset = await this.trainingData.collectAll();
    return {
      stats: dataset.metadata,
      validation: dataset.metadata.validation,
    };
  }
}
