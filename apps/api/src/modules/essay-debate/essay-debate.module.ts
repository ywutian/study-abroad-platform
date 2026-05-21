import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { PointsModule } from '../points/points.module';
import { EssayDebateController } from './essay-debate.controller';
import { EssayDebateService } from './essay-debate.service';
import { DebateBudgetService } from './debate-budget.service';
import { DebateContextLoaderService } from './debate-context-loader.service';
import { AdminDebateEvalController } from './admin-debate-eval.controller';
import { DebateBlindEvalService } from './debate-blind-eval.service';

/**
 * Phase 2 V1 PR3 — adds the Day-6 blind-eval admin endpoints +
 * EssayDebateEvaluation persistence layer. PR1 shipped the session
 * schema; PR2 wired Claude; PR3 captures counsellor ratings.
 *
 * `LLMService` is provided globally by `LLMProvidersModule.forRoot()` in
 * `AiAgentModule`, so we don't import it here. The context loader uses
 * Prisma directly to avoid pulling in the heavier ProfileModule +
 * PredictionModule dependency tree.
 */
@Module({
  imports: [PrismaModule, RedisModule, PointsModule],
  controllers: [EssayDebateController, AdminDebateEvalController],
  providers: [
    EssayDebateService,
    DebateBudgetService,
    DebateContextLoaderService,
    DebateBlindEvalService,
  ],
  exports: [EssayDebateService],
})
export class EssayDebateModule {}
