import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { PointsModule } from '../points/points.module';
import { EssayDebateController } from './essay-debate.controller';
import { EssayDebateService } from './essay-debate.service';
import { DebateBudgetService } from './debate-budget.service';

/**
 * Phase 2 V1 PR1 — skeleton module.
 * Wires the turn endpoint + Redis-backed daily budget. Real Claude
 * integration (and the context loader described in
 * `CONTEXT_AUDIT.md`) lands in PR2.
 */
@Module({
  imports: [PrismaModule, RedisModule, PointsModule],
  controllers: [EssayDebateController],
  providers: [EssayDebateService, DebateBudgetService],
  exports: [EssayDebateService],
})
export class EssayDebateModule {}
