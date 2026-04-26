import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { RedisModule } from '../../../common/redis/redis.module';
import { CounselorEngineService } from './counselor-engine.service';
import { CounselorBackfillService } from './counselor-backfill.service';
import { PredictionTransformerService } from '../prediction-transformer.service';

/**
 * Counselor Engine Module — cold-start anchored prediction engine.
 *
 * Provides:
 *   - `CounselorEngineService` — pure compute, no IO except CDS / SchoolProgram lookups
 *   - `CounselorBackfillService` — admin-triggered backfill that rewrites stored
 *     PredictionResult rows to use counselor (PR-7).
 *
 * Why we re-provide `PredictionTransformerService` here instead of importing
 * PredictionModule: PredictionModule already imports this module (for the
 * counselor branch in PR-2), so importing back would close the cycle.
 * `PredictionTransformerService` is a stateless pure-function service with
 * trivial deps — re-providing it here is cleaner than forwardRef gymnastics.
 *
 * The 8 modifier functions in `counselor-modifiers.ts` are pure — no DI needed.
 */
@Module({
  imports: [PrismaModule, RedisModule],
  providers: [
    CounselorEngineService,
    CounselorBackfillService,
    PredictionTransformerService,
  ],
  exports: [CounselorEngineService, CounselorBackfillService],
})
export class CounselorEngineModule {}
