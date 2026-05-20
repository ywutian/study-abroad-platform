import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { PointsModule } from '../points/points.module';
import { EssayDebateController } from './essay-debate.controller';
import { EssayDebateService } from './essay-debate.service';
import { DebateBudgetService } from './debate-budget.service';
import { DebateContextLoaderService } from './debate-context-loader.service';

/**
 * Phase 2 V1 PR2 — real Claude + 6-context loader.
 *
 * `LLMService` is provided globally by `LLMProvidersModule.forRoot()` in
 * `AiAgentModule`, so we don't import it here. The context loader uses
 * Prisma directly to avoid pulling in the heavier ProfileModule +
 * PredictionModule dependency tree.
 */
@Module({
  imports: [PrismaModule, RedisModule, PointsModule],
  controllers: [EssayDebateController],
  providers: [
    EssayDebateService,
    DebateBudgetService,
    DebateContextLoaderService,
  ],
  exports: [EssayDebateService],
})
export class EssayDebateModule {}
