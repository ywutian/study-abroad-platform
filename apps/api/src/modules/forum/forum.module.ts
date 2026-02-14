import { Module, forwardRef } from '@nestjs/common';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';
import { ForumAdminController } from './forum-admin.controller';
import { ForumModerationService } from './moderation.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiAgentModule } from '../ai-agent/ai-agent.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AiAgentModule)],
  providers: [ForumService, ForumModerationService],
  controllers: [ForumController, ForumAdminController],
  exports: [ForumService, ForumModerationService],
})
export class ForumModule {}
