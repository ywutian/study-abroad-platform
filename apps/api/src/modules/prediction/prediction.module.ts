import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PredictionService } from './prediction.service';
import { PredictionController } from './prediction.controller';
import { AdminPredictionFeedbackController } from './admin-prediction-feedback.controller';
import { RedisModule } from '../../common/redis/redis.module';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';
import { SchoolModule } from '../school/school.module';
import { PointsModule } from '../points/points.module';
import { PredictionTransformerService } from './prediction-transformer.service';
import { PredictionStatisticalEngine } from './prediction-statistical-engine.service';
import { PredictionAiEngine } from './prediction-ai-engine.service';
import { PredictionFusionEngine } from './prediction-fusion-engine.service';
import { PredictionCacheService } from './prediction-cache.service';
import { PredictionCalibrationService } from './prediction-calibration.service';
import { PredictionHistoricalService } from './prediction-historical.service';
import { PredictionMemoryService } from './prediction-memory.service';
import { PredictionPersistenceService } from './prediction-persistence.service';
import { PredictionReportingService } from './prediction-reporting.service';
import { PredictionFeedbackService } from './prediction-feedback.service';
import { PredictionExplanationService } from './prediction-explanation.service';
import { PredictionPolicyService } from './prediction-policy.service';
import { PredictionWorkflowService } from './prediction-workflow.service';
import { PredictionPolicyShadowService } from './prediction-policy-shadow.service';
import { PredictionHookModifiersService } from './prediction-hook-modifiers.service';
import { DistillationModule } from './distillation/distillation.module';
import { CounselorEngineModule } from './counselor/counselor-engine.module';
import { forwardRef } from '@nestjs/common';

/**
 * Prediction Module — counselor primary architecture
 *
 * As of 2026-05-07, the served prediction path is the CounselorEngine
 * (industry-standard rules-of-thumb anchored on CDS admit bands).
 *
 * The legacy ML platform layer (ml/, benchmark/, prediction-ml-primary,
 * prediction-ml.controller, diagnostic-ingest) was removed because:
 *   1. ModelRegistry never had a CHAMPION model trained (no labeled outcomes)
 *   2. Counselor mode is at 100% rollout and overrides any ML output
 *   3. CollegeVine / PrepScholar / Niche all use rule-based, not ML
 *
 * If real ML training resumes (after ≥50 verified outcomes per cohort),
 * restore via `git log --diff-filter=D -- apps/api/src/modules/prediction/ml/`.
 */
@Module({
  imports: [
    RedisModule,
    AiAgentMemoryModule,
    SchoolModule,
    ScheduleModule,
    PointsModule,
    // forwardRef paired with DistillationModule's reciprocal forwardRef —
    // distillation depends on PredictionService for the admin dry-run
    // endpoint while prediction depends on the distillation services for
    // the served blend. forwardRef defers both resolutions to runtime.
    forwardRef(() => DistillationModule),
    // Cold-start counselor engine — primary served path. PredictionService
    // injects CounselorEngineService when the prediction-counselor-mode-v1
    // feature flag is enabled.
    CounselorEngineModule,
  ],
  controllers: [PredictionController, AdminPredictionFeedbackController],
  providers: [
    PredictionTransformerService,
    PredictionStatisticalEngine,
    PredictionAiEngine,
    PredictionFusionEngine,
    PredictionService,
    PredictionCacheService,
    PredictionCalibrationService,
    PredictionHistoricalService,
    PredictionMemoryService,
    PredictionPersistenceService,
    PredictionReportingService,
    PredictionFeedbackService,
    PredictionExplanationService,
    PredictionPolicyService,
    PredictionWorkflowService,
    PredictionPolicyShadowService,
    PredictionHookModifiersService,
  ],
  exports: [
    PredictionService,
    PredictionHistoricalService,
    PredictionCalibrationService,
    PredictionReportingService,
    PredictionExplanationService,
    PredictionPolicyService,
    PredictionWorkflowService,
    PredictionPolicyShadowService,
  ],
})
export class PredictionModule {}
