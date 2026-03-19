import { Module } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';
import { PointsModule } from '../points/points.module';
import { RedisModule } from '../../common/redis/redis.module';
import { SchoolModule } from '../school/school.module';

@Module({
  imports: [
    PrismaModule,
    AiAgentMemoryModule,
    PointsModule,
    RedisModule,
    SchoolModule,
  ],
  providers: [RecommendationService],
  controllers: [RecommendationController],
  exports: [RecommendationService],
})
export class RecommendationModule {}
