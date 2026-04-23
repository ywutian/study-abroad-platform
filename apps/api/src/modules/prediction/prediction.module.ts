import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PredictionService } from './prediction.service';
import { PredictionController } from './prediction.controller';
import { PredictionMlController } from './prediction-ml.controller';
import { RedisModule } from '../../common/redis/redis.module';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';
import { SchoolModule } from '../school/school.module';
import { PointsModule } from '../points/points.module';
import { ModelRegistryService } from './ml/model-registry.service';
import { TrainingDataService } from './ml/training-data.service';
import { ModelTrainerService } from './ml/model-trainer.service';
import { ShadowEvaluatorService } from './ml/shadow-evaluator.service';
import { ModelMonitorService } from './ml/model-monitor.service';
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
import { PredictionPolicyService } from './prediction-policy.service';
import { PredictionWorkflowService } from './prediction-workflow.service';
import { PredictionPolicyShadowService } from './prediction-policy-shadow.service';
import { PredictionHookModifiersService } from './prediction-hook-modifiers.service';
import { PredictionMlPrimaryService } from './prediction-ml-primary.service';
import { DiagnosticIngestService } from './diagnostic-ingest.service';
import {
  BENCHMARK_CONTROLLERS,
  BENCHMARK_PROVIDERS,
} from './benchmark/benchmark.module';
import { DistillationModule } from './distillation/distillation.module';

@Module({
  imports: [
    RedisModule,
    AiAgentMemoryModule,
    SchoolModule,
    ScheduleModule,
    PointsModule,
    DistillationModule,
  ],
  controllers: [
    PredictionController,
    PredictionMlController,
    ...BENCHMARK_CONTROLLERS,
  ],
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
    PredictionPolicyService,
    PredictionWorkflowService,
    PredictionPolicyShadowService,
    ModelRegistryService,
    TrainingDataService,
    ModelTrainerService,
    ShadowEvaluatorService,
    ModelMonitorService,
    PredictionHookModifiersService,
    PredictionMlPrimaryService,
    ...BENCHMARK_PROVIDERS,
    DiagnosticIngestService,
  ],
  exports: [
    PredictionService,
    PredictionHistoricalService,
    PredictionCalibrationService,
    PredictionReportingService,
    PredictionPolicyService,
    PredictionWorkflowService,
    PredictionPolicyShadowService,
  ],
})
export class PredictionModule {}
