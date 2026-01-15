import { Module, forwardRef } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { AiModule } from '../ai/ai.module';
import { AiAgentModule } from '../ai-agent/ai-agent.module';
import { SchoolListModule } from '../school-list/school-list.module';

@Module({
  imports: [AiModule, forwardRef(() => AiAgentModule), SchoolListModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
