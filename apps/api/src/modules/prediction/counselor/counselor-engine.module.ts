import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CounselorEngineService } from './counselor-engine.service';

/**
 * Counselor Engine Module — cold-start anchored prediction engine.
 *
 * Lightweight: only depends on PrismaModule (for `SchoolCdsAdmitBand` + `SchoolProgram`
 * lookups). The 8 modifier functions in `counselor-modifiers.ts` are pure — no DI
 * needed. The service is the only injectable here.
 *
 * Imported by `PredictionModule` so the prediction service can call it when the
 * `prediction-counselor-mode-v1` feature flag is enabled (PR-2).
 */
@Module({
  imports: [PrismaModule],
  providers: [CounselorEngineService],
  exports: [CounselorEngineService],
})
export class CounselorEngineModule {}
