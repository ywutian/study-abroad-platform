import { Module } from '@nestjs/common';

import { AdminPredictionBenchmarkController } from './admin-benchmark.controller';
import { PredictionBenchmarkService } from './benchmark.service';

/**
 * M3 prediction benchmark — admin co-review surface.
 *
 * Pure read-only display + free-form comment threads. The runs themselves
 * are seeded by scripts/seed-prediction-benchmark.ts after a developer
 * executes the structural + v3 case benchmarks locally.
 */
@Module({
  controllers: [AdminPredictionBenchmarkController],
  providers: [PredictionBenchmarkService],
  exports: [PredictionBenchmarkService],
})
export class PredictionBenchmarkModule {}
