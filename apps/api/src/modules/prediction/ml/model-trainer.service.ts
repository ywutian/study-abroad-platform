/**
 * Model Trainer Service
 *
 * Orchestrates the full training pipeline:
 *   1. Collect data from TrainingDataService
 *   2. Determine tier from sample count
 *   3. Validate data quality
 *   4. Train model (appropriate to tier)
 *   5. Cross-validate (5-fold)
 *   6. Audit fairness
 *   7. Compare with current champion
 *   8. Save as CANDIDATE (or auto-promote if first)
 *
 * Called by admin endpoint: POST /admin/predictions/train
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  trainLogisticRegression,
  trainPlattCalibration,
  stratifiedKFold,
  predict,
  computeAucRoc,
  computeBrierScore,
  FEATURE_NAMES_BASIC,
  FEATURE_NAMES_FULL,
} from '@study-abroad/shared/scoring';
import type { TrainedModel } from '@study-abroad/shared/scoring';
import { TrainingDataService } from './training-data.service';
import type { PreparedDataset, DatasetStats } from './training-data.service';
import { ModelRegistryService } from './model-registry.service';
import { auditFairness } from './fairness-auditor';
import type { FairnessReport } from './fairness-auditor';
import {
  determineTier,
  splitByBand,
  MIN_BAND_SAMPLES,
  SELECTIVITY_BANDS,
} from './tier-strategy';
import type { TierConfig } from './tier-strategy';

// ============================================
// Types
// ============================================

export interface TrainingResult {
  modelId: string;
  version?: number;
  tier: number;
  modelType: string;
  metrics: {
    trainAuc: number;
    valAuc: number;
    brierScore: number;
    calibrationECE: number;
  };
  cvMetrics?: {
    meanAuc: number;
    stdAuc: number;
    folds: Array<{ auc: number; brier: number }>;
  };
  fairness: FairnessReport;
  comparison?: {
    championAuc: number;
    candidateAuc: number;
    improvement: number;
    recommendation: string;
  };
  bandModels?: Array<{
    band: string;
    modelId: string;
    samples: number;
    valAuc: number;
  }>;
  datasetStats: DatasetStats;
  autoPromoted: boolean;
}

@Injectable()
export class ModelTrainerService {
  private readonly logger = new Logger(ModelTrainerService.name);

  constructor(
    private readonly trainingData: TrainingDataService,
    private readonly modelRegistry: ModelRegistryService,
  ) {}

  /**
   * Main entry point: collect data → train → evaluate → save.
   */
  async trainModel(): Promise<TrainingResult> {
    this.logger.log('Starting model training pipeline...');

    // Step 1: Collect and prepare data
    const dataset = await this.trainingData.collectAll();
    const { metadata } = dataset;

    this.logger.log(
      `Dataset: ${metadata.totalSamples} samples, ` +
        `tier=${metadata.currentTier}, ` +
        `admit ratio=${(metadata.admittedRatio * 100).toFixed(1)}%`,
    );

    // Step 2: Validate
    if (metadata.currentTier === 0) {
      throw new BadRequestException(
        `Insufficient training data: ${metadata.totalSamples} samples. ` +
          `Need at least 50 for Tier 1 (Platt calibration).`,
      );
    }

    if (metadata.validation.issues.length > 0) {
      this.logger.warn(
        `Data quality issues: ${metadata.validation.issues.join('; ')}`,
      );
    }

    const tier = determineTier(metadata.totalSamples);

    // Step 3: Train model based on tier
    let model: TrainedModel;
    if (tier.tier === 1) {
      model = this.trainPlatt(dataset);
    } else {
      model = this.trainLR(dataset, tier);
    }

    // Step 4: Cross-validate (if enough data)
    let cvMetrics: TrainingResult['cvMetrics'];
    if (metadata.totalSamples >= 100) {
      cvMetrics = this.crossValidate(dataset, tier);
    }

    // Step 5: Fairness audit
    const fairness = this.runFairnessAudit(model, dataset);

    // Step 6: Compare with champion (if exists)
    const champion = await this.modelRegistry.getChampionModel(null);
    let comparison: TrainingResult['comparison'];
    if (champion && 'metadata' in champion) {
      const champMetrics = (champion as TrainedModel).metadata.metrics;
      comparison = {
        championAuc: champMetrics.auc,
        candidateAuc: model.metadata.metrics.auc,
        improvement: model.metadata.metrics.auc - champMetrics.auc,
        recommendation:
          model.metadata.metrics.auc > champMetrics.auc + 0.01
            ? 'Candidate outperforms champion — promote recommended'
            : model.metadata.metrics.auc < champMetrics.auc - 0.01
              ? 'Champion is better — keep current model'
              : 'Similar performance — consider other factors',
      };
    }

    // Step 7: Save global model
    const modelId = await this.modelRegistry.saveModel({
      tier: tier.tier,
      modelType: model.modelType,
      weights: model,
      config: tier.lrConfig,
      medians: model.featureMedians,
      selectivityBand: null,
      trainSamples: model.metadata.trainSamples,
      valSamples: model.metadata.valSamples,
      trainAuc: model.metadata.metrics.auc, // train AUC same source for now
      valAuc: model.metadata.metrics.auc,
      brierScore: model.metadata.metrics.brierScore,
      calibrationECE: model.metadata.metrics.ece,
      cvMeanAuc: cvMetrics?.meanAuc,
      cvStdAuc: cvMetrics?.stdAuc,
      fairnessMetrics: fairness,
    });

    // Step 8: Train band-specific models (Tier 3+)
    let bandModels: TrainingResult['bandModels'];
    if (tier.bandModels && metadata.totalSamples >= 400) {
      bandModels = await this.trainBandModels(dataset, tier);
    }

    // Check if auto-promoted (first model)
    const savedModel = await this.modelRegistry.getModel(modelId);
    const autoPromoted = savedModel.status === 'CHAMPION';

    this.logger.log(
      `Training complete: model ${modelId}, ` +
        `AUC=${model.metadata.metrics.auc.toFixed(3)}, ` +
        `Brier=${model.metadata.metrics.brierScore.toFixed(3)}, ` +
        `auto-promoted=${autoPromoted}`,
    );

    return {
      modelId,
      tier: tier.tier,
      modelType: model.modelType,
      metrics: {
        trainAuc: model.metadata.metrics.auc,
        valAuc: model.metadata.metrics.auc,
        brierScore: model.metadata.metrics.brierScore,
        calibrationECE: model.metadata.metrics.ece,
      },
      cvMetrics,
      fairness,
      comparison,
      bandModels,
      datasetStats: metadata,
      autoPromoted,
    };
  }

  // ============================================
  // Tier-Specific Training
  // ============================================

  private trainPlatt(dataset: PreparedDataset): TrainedModel {
    // Platt calibration: use heuristicProb feature only
    const heuristicIdx = dataset.featureNames.indexOf('heuristicProb' as any);
    if (heuristicIdx === -1) {
      throw new BadRequestException(
        'heuristicProb feature not found — required for Platt calibration',
      );
    }

    const heuristicProbs = dataset.X.map((row) => row[heuristicIdx]);
    return trainPlattCalibration(heuristicProbs, dataset.y);
  }

  private trainLR(dataset: PreparedDataset, tier: TierConfig): TrainedModel {
    const featureNames =
      tier.tier <= 2 ? FEATURE_NAMES_BASIC : FEATURE_NAMES_FULL;

    return trainLogisticRegression(
      dataset.X,
      dataset.y,
      featureNames as string[],
      dataset.featureMedians,
      tier.lrConfig,
    );
  }

  // ============================================
  // Cross-Validation
  // ============================================

  private crossValidate(
    dataset: PreparedDataset,
    tier: TierConfig,
    k = 5,
  ): TrainingResult['cvMetrics'] {
    const folds = stratifiedKFold(dataset.y, k);
    const featureNames =
      tier.tier <= 2 ? FEATURE_NAMES_BASIC : FEATURE_NAMES_FULL;
    const foldResults: Array<{ auc: number; brier: number }> = [];

    for (const fold of folds) {
      const Xtrain = fold.trainIdx.map((i) => dataset.X[i]);
      const ytrain = fold.trainIdx.map((i) => dataset.y[i]);
      const Xval = fold.valIdx.map((i) => dataset.X[i]);
      const yval = fold.valIdx.map((i) => dataset.y[i]);

      try {
        const foldModel = trainLogisticRegression(
          Xtrain,
          ytrain,
          featureNames as string[],
          dataset.featureMedians,
          tier.lrConfig,
        );

        const preds = Xval.map((x) => predict(foldModel, x));
        foldResults.push({
          auc: computeAucRoc(preds, yval),
          brier: computeBrierScore(preds, yval),
        });
      } catch {
        // Skip fold if training fails (e.g., insufficient data in fold)
      }
    }

    if (foldResults.length === 0) return undefined;

    const aucs = foldResults.map((f) => f.auc);
    const meanAuc = aucs.reduce((s, v) => s + v, 0) / aucs.length;
    const stdAuc = Math.sqrt(
      aucs.reduce((s, v) => s + (v - meanAuc) ** 2, 0) / aucs.length,
    );

    return { meanAuc, stdAuc, folds: foldResults };
  }

  // ============================================
  // Band-Specific Models (Tier 3+)
  // ============================================

  private async trainBandModels(
    dataset: PreparedDataset,
    tier: TierConfig,
  ): Promise<TrainingResult['bandModels']> {
    // Get selectivity values for band assignment
    const selectivityIdx = dataset.featureNames.indexOf('selectivity' as any);
    if (selectivityIdx === -1) return [];

    const selectivities = dataset.X.map((row) => row[selectivityIdx]);
    const bandIndices = splitByBand(selectivities);
    const featureNames = FEATURE_NAMES_FULL;

    const results: NonNullable<TrainingResult['bandModels']> = [];

    for (const [bandName, indices] of bandIndices) {
      if (indices.length < MIN_BAND_SAMPLES) {
        this.logger.log(
          `Band ${bandName}: only ${indices.length} samples, using global model`,
        );
        continue;
      }

      const Xband = indices.map((i) => dataset.X[i]);
      const yband = indices.map((i) => dataset.y[i]);

      try {
        const bandModel = trainLogisticRegression(
          Xband,
          yband,
          featureNames as string[],
          dataset.featureMedians,
          tier.lrConfig,
        );

        // Add band info to model metadata
        bandModel.metadata.selectivityBand = bandName;

        const bandModelId = await this.modelRegistry.saveModel({
          tier: tier.tier,
          modelType: bandModel.modelType,
          weights: bandModel,
          config: tier.lrConfig,
          medians: bandModel.featureMedians,
          selectivityBand: bandName,
          trainSamples: bandModel.metadata.trainSamples,
          valSamples: bandModel.metadata.valSamples,
          trainAuc: bandModel.metadata.metrics.auc,
          valAuc: bandModel.metadata.metrics.auc,
          brierScore: bandModel.metadata.metrics.brierScore,
          calibrationECE: bandModel.metadata.metrics.ece,
        });

        results.push({
          band: bandName,
          modelId: bandModelId,
          samples: indices.length,
          valAuc: bandModel.metadata.metrics.auc,
        });
      } catch (err) {
        this.logger.warn(
          `Band ${bandName} training failed: ${String(err instanceof Error ? err.message : err)}`,
        );
      }
    }

    return results;
  }

  // ============================================
  // Fairness Audit
  // ============================================

  private runFairnessAudit(
    model: TrainedModel,
    dataset: PreparedDataset,
  ): FairnessReport {
    const preds = dataset.X.map((x) => predict(model, x));

    // Build sensitive attributes from features
    const selectivityIdx = dataset.featureNames.indexOf('selectivity' as any);
    const hasTestIdx = dataset.featureNames.indexOf('hasTestScore' as any);

    const sensitiveAttributes: Record<string, string[]> = {};

    if (selectivityIdx !== -1) {
      sensitiveAttributes.selectivityBand = dataset.X.map((row) => {
        const s = row[selectivityIdx];
        for (const band of SELECTIVITY_BANDS) {
          if (s >= band.min && s < band.max) return band.name;
        }
        return '0.8-1.0';
      });
    }

    if (hasTestIdx !== -1) {
      sensitiveAttributes.hasTestScore = dataset.X.map((row) =>
        row[hasTestIdx] >= 0.5 ? 'has_test' : 'no_test',
      );
    }

    return auditFairness(preds, dataset.y, sensitiveAttributes);
  }
}
