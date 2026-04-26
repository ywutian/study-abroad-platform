import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CompliantDistillationService } from './compliant-distillation.service';
import { DistillationObservationService } from './distillation-observation.service';
import { DistillationStatsRollupService } from './distillation-stats-rollup.service';
import { ScorecardTeacherService } from './teachers/scorecard-teacher.service';
import { IpedsTrendTeacherService } from './teachers/ipeds-trend-teacher.service';
import { ChineseCaseTeacherService } from './teachers/chinese-case-teacher.service';
import { ChineseOutcomeTeacherService } from './teachers/chinese-outcome-teacher.service';
import { CohortPriorTeacherService } from './teachers/cohort-prior-teacher.service';
import { CdsBandsTeacherService } from './teachers/cds-bands-teacher.service';
import { HooksTeacherService } from './teachers/hooks-teacher.service';
import { EdBoostTeacherService } from './teachers/ed-boost-teacher.service';
import { GeoCohortTeacherService } from './teachers/geo-cohort-teacher.service';
import { MajorSelectivityTeacherService } from './teachers/major-selectivity-teacher.service';
import { IntlPoolTeacherService } from './teachers/intl-pool-teacher.service';
import { ApRigorTeacherService } from './teachers/ap-rigor-teacher.service';
import { IbTeacherService } from './teachers/ib-teacher.service';
import { FeederHsTeacherService } from './teachers/feeder-hs-teacher.service';
import { ActivityIntensityTeacherService } from './teachers/activity-intensity-teacher.service';
import { PredictionDistillationController } from './prediction-distillation.controller';
import { PredictionPolicyService } from '../prediction-policy.service';
import { PredictionHookModifiersService } from '../prediction-hook-modifiers.service';
import { CdsBandsIngestionService } from './cds-bands-ingestion.service';
import { CaseAggregateBackfillService } from './case-aggregate-backfill.service';

// Lazy-import PredictionModule via forwardRef — PredictionModule already
// imports DistillationModule (because the prediction service blends teacher
// signals), so a direct import here would close the cycle. forwardRef tells
// Nest to resolve the dependency after both modules are constructed; the
// dry-run admin endpoint then injects PredictionService at request time.
import { PredictionModule } from '../prediction.module';
import { CounselorEngineModule } from '../counselor/counselor-engine.module';

@Module({
  // CounselorEngineModule is imported (no forwardRef needed — counselor only
  // depends on PrismaModule + RedisModule, no cycle back to distillation).
  // The PredictionDistillationController consumes CounselorBackfillService
  // from this module for the PR-7 backfill admin endpoint.
  imports: [
    PrismaModule,
    forwardRef(() => PredictionModule),
    CounselorEngineModule,
  ],
  controllers: [PredictionDistillationController],
  providers: [
    PredictionPolicyService,
    ScorecardTeacherService,
    IpedsTrendTeacherService,
    ChineseCaseTeacherService,
    ChineseOutcomeTeacherService,
    CohortPriorTeacherService,
    CdsBandsTeacherService,
    HooksTeacherService,
    EdBoostTeacherService,
    GeoCohortTeacherService,
    MajorSelectivityTeacherService,
    IntlPoolTeacherService,
    ApRigorTeacherService,
    IbTeacherService,
    FeederHsTeacherService,
    ActivityIntensityTeacherService,
    PredictionHookModifiersService,
    CdsBandsIngestionService,
    CaseAggregateBackfillService,
    DistillationObservationService,
    DistillationStatsRollupService,
    CompliantDistillationService,
  ],
  exports: [
    DistillationObservationService,
    DistillationStatsRollupService,
    CompliantDistillationService,
    ScorecardTeacherService,
    CdsBandsIngestionService,
  ],
})
export class DistillationModule {}
