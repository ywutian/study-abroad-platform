import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { ProfileHelpersService } from './profile-helpers.service';
import { ProfileCrudService } from './profile-crud.service';
import { ProfileScoresService } from './profile-scores.service';
import { ProfileEducationService } from './profile-education.service';
import { ProfileAnalysisService } from './profile-analysis.service';
import { ProfileMemoryService } from './profile-memory.service';
import { ProfileEnrichmentService } from './profile-enrichment.service';
import { ProfileApplicationAnalysisService } from './profile-application-analysis.service';
import { ApplicationAnalysisWorkflowService } from './application-analysis-workflow.service';
import { ApplicationAnalysisExperimentScheduler } from './application-analysis-experiment.scheduler';
import { FeatureFlagModule } from '../../common/feature-flags';
import { AiModule } from '../ai/ai.module';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';
import { SchoolListModule } from '../school-list/school-list.module';
import { PointsModule } from '../points/points.module';
import { PredictionModule } from '../prediction/prediction.module';

@Module({
  imports: [
    AiModule,
    AiAgentMemoryModule,
    SchoolListModule,
    PointsModule,
    PredictionModule,
    FeatureFlagModule,
    ScheduleModule,
  ],
  controllers: [ProfileController],
  providers: [
    ProfileHelpersService,
    ProfileCrudService,
    ProfileScoresService,
    ProfileEducationService,
    ProfileAnalysisService,
    ProfileMemoryService,
    ProfileEnrichmentService,
    ApplicationAnalysisWorkflowService,
    ApplicationAnalysisExperimentScheduler,
    ProfileApplicationAnalysisService,
    ProfileService,
  ],
  exports: [
    ProfileService,
    ProfileEnrichmentService,
    ApplicationAnalysisWorkflowService,
  ],
})
export class ProfileModule {}
