import { Module } from '@nestjs/common';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';
import { ForumAdminController } from './forum-admin.controller';
import { ForumModerationService } from './moderation.service';
import { ForumCategoryService } from './forum-category.service';
import { ForumPostService } from './forum-post.service';
import { ForumCommentService } from './forum-comment.service';
import { ForumTeamService } from './forum-team.service';
import { ForumReportService } from './forum-report.service';
import { ForumMemoryService } from './forum-memory.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, AiAgentMemoryModule, NotificationModule],
  providers: [
    ForumService,
    ForumModerationService,
    ForumCategoryService,
    ForumPostService,
    ForumCommentService,
    ForumTeamService,
    ForumReportService,
    ForumMemoryService,
  ],
  controllers: [ForumController, ForumAdminController],
  exports: [ForumService, ForumModerationService],
})
export class ForumModule {}
