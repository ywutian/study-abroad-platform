import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { ProfileHelpersService } from './profile-helpers.service';
import { ProfileCrudService } from './profile-crud.service';
import { ProfileScoresService } from './profile-scores.service';
import { ProfileEducationService } from './profile-education.service';
import { ProfileAnalysisService } from './profile-analysis.service';
import { ProfileMemoryService } from './profile-memory.service';
import { ProfileEnrichmentService } from './profile-enrichment.service';
import { AiModule } from '../ai/ai.module';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';
import { SchoolListModule } from '../school-list/school-list.module';

@Module({
  imports: [AiModule, AiAgentMemoryModule, SchoolListModule],
  controllers: [ProfileController],
  providers: [
    ProfileHelpersService,
    ProfileCrudService,
    ProfileScoresService,
    ProfileEducationService,
    ProfileAnalysisService,
    ProfileMemoryService,
    ProfileEnrichmentService,
    ProfileService,
  ],
  exports: [ProfileService, ProfileEnrichmentService],
})
export class ProfileModule {}
