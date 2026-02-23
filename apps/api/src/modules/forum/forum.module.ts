import { Module } from '@nestjs/common';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';
import { ForumAdminController } from './forum-admin.controller';
import { ForumModerationService } from './moderation.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';

@Module({
  imports: [PrismaModule, AiAgentMemoryModule],
  providers: [ForumService, ForumModerationService],
  controllers: [ForumController, ForumAdminController],
  exports: [ForumService, ForumModerationService],
})
export class ForumModule {}
