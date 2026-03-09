/**
 * Model Monitor Service
 *
 * Daily cron job that checks:
 *   1. Prediction drift (PSI — Population Stability Index)
 *   2. Online calibration (ECE on recent outcomes)
 *   3. Data growth (has enough data accumulated for a tier upgrade?)
 *
 * Alerts admin via logger (can be extended to notification service).
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { computePSI, computeECE } from '@study-abroad/shared/scoring';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { TrainingDataService } from './training-data.service';
import { ModelRegistryService } from './model-registry.service';
import { determineTier } from './tier-strategy';

// ============================================
// Types
// ============================================

export interface DriftReport {
  psi: number | null;
  status: 'ok' | 'warning' | 'alert';
  message: string;
  recentPredictionCount: number;
}

export interface CalibrationReport {
  ece: number | null;
  status: 'ok' | 'warning' | 'alert';
  recentOutcomeCount: number;
  message: string;
}

export interface DataGrowthReport {
  currentSamples: number;
  currentTier: number;
  availableTier: number;
  tierCrossed: boolean;
  nextTierThreshold: number | null;
}

export interface MonitorReport {
  drift: DriftReport;
  calibration: CalibrationReport;
  dataGrowth: DataGrowthReport;
  checkedAt: string;
}

// ============================================
// Thresholds
// ============================================

const PSI_WARNING = 0.1;
const PSI_ALERT = 0.25;
const ECE_WARNING = 0.1;
const ECE_ALERT = 0.15;

const PREDICTION_DIST_KEY = 'ml:monitor:pred_dist';
const MONITOR_REPORT_KEY = 'ml:monitor:latest_report';
const REPORT_TTL = 60 * 60 * 48; // 48 hours

@Injectable()
export class ModelMonitorService {
  private readonly logger = new Logger(ModelMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly trainingData: TrainingDataService,
    private readonly modelRegistry: ModelRegistryService,
  ) {}

  /**
   * Daily monitoring check at 3am.
   */
  @Cron('0 3 * * *')
  async runDailyChecks(): Promise<void> {
    this.logger.log('Running daily ML model checks...');

    const [drift, calibration, dataGrowth] = await Promise.all([
      this.checkPredictionDrift(),
      this.checkCalibration(),
      this.checkDataGrowth(),
    ]);

    const report: MonitorReport = {
      drift,
      calibration,
      dataGrowth,
      checkedAt: new Date().toISOString(),
    };

    // Store report for admin dashboard
    await this.redis.setJSON(MONITOR_REPORT_KEY, report, REPORT_TTL);

    // Log alerts
    if (drift.status === 'alert') {
      this.logger.error(
        `[ML ALERT] Prediction drift detected: PSI=${drift.psi?.toFixed(3)}`,
      );
    } else if (drift.status === 'warning') {
      this.logger.warn(
        `[ML WARNING] Prediction drift increasing: PSI=${drift.psi?.toFixed(3)}`,
      );
    }

    if (calibration.status === 'alert') {
      this.logger.error(
        `[ML ALERT] Poor calibration: ECE=${calibration.ece?.toFixed(3)}`,
      );
    }

    if (dataGrowth.tierCrossed) {
      this.logger.log(
        `[ML INFO] Data has crossed tier boundary: ` +
          `${dataGrowth.currentSamples} samples available, ` +
          `current tier=${dataGrowth.currentTier}, available tier=${dataGrowth.availableTier}. ` +
          `Consider running POST /admin/predictions/train`,
      );
    }

    this.logger.log('Daily ML checks complete');
  }

  /**
   * Get the latest monitor report (for admin dashboard).
   */
  async getLatestReport(): Promise<MonitorReport | null> {
    return this.redis.getJSON<MonitorReport>(MONITOR_REPORT_KEY);
  }

  /**
   * Run checks on demand (for admin endpoint).
   */
  async runChecksNow(): Promise<MonitorReport> {
    const [drift, calibration, dataGrowth] = await Promise.all([
      this.checkPredictionDrift(),
      this.checkCalibration(),
      this.checkDataGrowth(),
    ]);

    const report: MonitorReport = {
      drift,
      calibration,
      dataGrowth,
      checkedAt: new Date().toISOString(),
    };

    await this.redis.setJSON(MONITOR_REPORT_KEY, report, REPORT_TTL);
    return report;
  }

  // ============================================
  // Prediction Drift (PSI)
  // ============================================

  /**
   * Record a served prediction for drift monitoring.
   * Called from prediction.service.ts on each prediction.
   */
  async recordPrediction(probability: number): Promise<void> {
    // Store in a list (last 10000 predictions)
    await this.redis.lpush(PREDICTION_DIST_KEY, probability.toFixed(4));
    // Trim to last 10000
    await this.redis.ltrim(PREDICTION_DIST_KEY, 0, 9999);
  }

  private async checkPredictionDrift(): Promise<DriftReport> {
    // Get recent prediction distribution
    const recentRaw = await this.redis.lrange(PREDICTION_DIST_KEY, 0, -1);
    const recentPreds = recentRaw.map(Number).filter((n) => !isNaN(n));

    if (recentPreds.length < 100) {
      return {
        psi: null,
        status: 'ok',
        message: `Not enough predictions for drift analysis (${recentPreds.length}/100)`,
        recentPredictionCount: recentPreds.length,
      };
    }

    // Get champion model's training distribution (use validation predictions)
    const champion = await this.modelRegistry.getChampionModel(null);
    if (!champion) {
      return {
        psi: null,
        status: 'ok',
        message: 'No champion model — drift check skipped',
        recentPredictionCount: recentPreds.length,
      };
    }

    // Use a uniform reference distribution as baseline (0.05 to 0.95)
    // In production, we'd store the training distribution alongside the model
    const refDist = Array.from(
      { length: recentPreds.length },
      (_, i) => 0.05 + (0.9 * i) / (recentPreds.length - 1),
    );

    const psi = computePSI(refDist, recentPreds, 10);

    let status: DriftReport['status'] = 'ok';
    let message = `PSI=${psi.toFixed(3)} — no significant drift`;
    if (psi > PSI_ALERT) {
      status = 'alert';
      message = `PSI=${psi.toFixed(3)} — significant drift detected, consider retraining`;
    } else if (psi > PSI_WARNING) {
      status = 'warning';
      message = `PSI=${psi.toFixed(3)} — moderate drift, monitor closely`;
    }

    return { psi, status, message, recentPredictionCount: recentPreds.length };
  }

  // ============================================
  // Online Calibration
  // ============================================

  private async checkCalibration(): Promise<CalibrationReport> {
    // Get recent predictions with outcomes
    const recentOutcomes = await this.prisma.predictionResult.findMany({
      where: {
        actualResult: { in: ['ADMITTED', 'REJECTED'] },
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // last 90 days
      },
      select: {
        probability: true,
        actualResult: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    if (recentOutcomes.length < 20) {
      return {
        ece: null,
        status: 'ok',
        recentOutcomeCount: recentOutcomes.length,
        message: `Not enough outcomes for calibration check (${recentOutcomes.length}/20)`,
      };
    }

    const preds = recentOutcomes.map((o) => Number(o.probability));
    const labels = recentOutcomes.map((o) =>
      o.actualResult === 'ADMITTED' ? (1 as const) : (0 as const),
    );
    const ece = computeECE(preds, labels, 5);

    let status: CalibrationReport['status'] = 'ok';
    let message = `ECE=${ece.toFixed(3)} — well calibrated`;
    if (ece > ECE_ALERT) {
      status = 'alert';
      message = `ECE=${ece.toFixed(3)} — poor calibration, consider retraining`;
    } else if (ece > ECE_WARNING) {
      status = 'warning';
      message = `ECE=${ece.toFixed(3)} — calibration degrading`;
    }

    return { ece, status, recentOutcomeCount: recentOutcomes.length, message };
  }

  // ============================================
  // Data Growth
  // ============================================

  private async checkDataGrowth(): Promise<DataGrowthReport> {
    const currentSamples = await this.trainingData.countAvailableOutcomes();
    const currentChampion = await this.modelRegistry.getChampionModel(null);

    const currentTier = currentChampion
      ? (((currentChampion as any).metadata?.tier ?? 0) as number)
      : 0;

    const available = determineTier(currentSamples);

    const tierThresholds = [50, 200, 1000, 5000];
    const nextThreshold = currentTier < 4 ? tierThresholds[currentTier] : null;

    return {
      currentSamples,
      currentTier,
      availableTier: available.tier,
      tierCrossed: available.tier > currentTier,
      nextTierThreshold: nextThreshold,
    };
  }
}
