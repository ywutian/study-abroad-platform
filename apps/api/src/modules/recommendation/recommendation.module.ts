import { Module } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';
import { CaseModule } from '../case/case.module';
import { RedisModule } from '../../common/redis/redis.module';
import { SchoolModule } from '../school/school.module';

@Module({
  imports: [
    PrismaModule,
    AiModule,
    AiAgentMemoryModule,
    CaseModule,
    RedisModule,
    SchoolModule,
  ],
  providers: [RecommendationService],
  controllers: [RecommendationController],
  exports: [RecommendationService],
})
export class RecommendationModule {}
