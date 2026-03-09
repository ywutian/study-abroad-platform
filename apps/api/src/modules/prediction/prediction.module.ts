import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PredictionService } from './prediction.service';
import { PredictionController } from './prediction.controller';
import { PredictionMlController } from './prediction-ml.controller';
import { AiModule } from '../ai/ai.module';
import { RedisModule } from '../../common/redis/redis.module';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';
import { SchoolModule } from '../school/school.module';
import { ModelRegistryService } from './ml/model-registry.service';
import { TrainingDataService } from './ml/training-data.service';
import { ModelTrainerService } from './ml/model-trainer.service';
import { ShadowEvaluatorService } from './ml/shadow-evaluator.service';
import { ModelMonitorService } from './ml/model-monitor.service';

@Module({
  imports: [
    AiModule,
    RedisModule,
    AiAgentMemoryModule,
    SchoolModule,
    ScheduleModule,
  ],
  controllers: [PredictionController, PredictionMlController],
  providers: [
    PredictionService,
    ModelRegistryService,
    TrainingDataService,
    ModelTrainerService,
    ShadowEvaluatorService,
    ModelMonitorService,
  ],
  exports: [PredictionService],
})
export class PredictionModule {}
