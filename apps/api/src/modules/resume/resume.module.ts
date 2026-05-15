import { Module } from '@nestjs/common';
import { ResumeController } from './resume.controller';
import { ResumeV2Controller } from './resume-v2.controller';
import { ResumeService } from './resume.service';
import { AiModule } from '../ai/ai.module';
import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [AiModule, ProfileModule],
  controllers: [ResumeController, ResumeV2Controller],
  providers: [ResumeService],
  exports: [ResumeService],
})
export class ResumeModule {}
