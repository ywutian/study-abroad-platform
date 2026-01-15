import { Module, forwardRef } from '@nestjs/common';
import { PredictionService } from './prediction.service';
import { PredictionController } from './prediction.controller';
import { AiModule } from '../ai/ai.module';
import { RedisModule } from '../../common/redis/redis.module';
import { AiAgentModule } from '../ai-agent/ai-agent.module';

@Module({
  imports: [
    forwardRef(() => AiModule),
    RedisModule,
    forwardRef(() => AiAgentModule),
  ],
  controllers: [PredictionController],
  providers: [PredictionService],
  exports: [PredictionService],
})
export class PredictionModule {}
