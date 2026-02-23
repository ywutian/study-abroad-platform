import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { AiModule } from '../ai/ai.module';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';
import { SchoolListModule } from '../school-list/school-list.module';

@Module({
  imports: [AiModule, AiAgentMemoryModule, SchoolListModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
