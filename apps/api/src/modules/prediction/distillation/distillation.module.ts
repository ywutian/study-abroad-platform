import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CompliantDistillationService } from './compliant-distillation.service';
import { DistillationObservationService } from './distillation-observation.service';
import { DistillationStatsRollupService } from './distillation-stats-rollup.service';
import { ScorecardTeacherService } from './teachers/scorecard-teacher.service';
import { IpedsTrendTeacherService } from './teachers/ipeds-trend-teacher.service';
import { ChineseCaseTeacherService } from './teachers/chinese-case-teacher.service';
import { ChineseOutcomeTeacherService } from './teachers/chinese-outcome-teacher.service';
import { CohortPriorTeacherService } from './teachers/cohort-prior-teacher.service';
import { PredictionDistillationController } from './prediction-distillation.controller';
import { PredictionPolicyService } from '../prediction-policy.service';

@Module({
  imports: [PrismaModule],
  controllers: [PredictionDistillationController],
  providers: [
    PredictionPolicyService,
    ScorecardTeacherService,
    IpedsTrendTeacherService,
    ChineseCaseTeacherService,
    ChineseOutcomeTeacherService,
    CohortPriorTeacherService,
    DistillationObservationService,
    DistillationStatsRollupService,
    CompliantDistillationService,
  ],
  exports: [
    DistillationObservationService,
    DistillationStatsRollupService,
    CompliantDistillationService,
    ScorecardTeacherService,
  ],
})
export class DistillationModule {}
