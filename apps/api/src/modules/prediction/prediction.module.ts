import { Module } from '@nestjs/common';
import { PredictionService } from './prediction.service';
import { PredictionController } from './prediction.controller';
import { AiModule } from '../ai/ai.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [AiModule, RedisModule],
  controllers: [PredictionController],
  providers: [PredictionService],
  exports: [PredictionService],
})
export class PredictionModule {}

