import { Module } from '@nestjs/common';
import { ProfileAiService } from './profile-ai.service';
import { ResumeAiService } from './resume-ai.service';

@Module({
  providers: [ProfileAiService, ResumeAiService],
  exports: [ProfileAiService, ResumeAiService],
})
export class AiModule {}
