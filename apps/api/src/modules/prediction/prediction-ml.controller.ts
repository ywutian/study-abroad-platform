/**
 * ML Prediction Admin Controller
 *
 * Admin-only endpoints for model training, management, monitoring, and fairness auditing.
 */

import { Controller, Get, Post, Param, Query } from '@nestjs/common';
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
  ) {}

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
