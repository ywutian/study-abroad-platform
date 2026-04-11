import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../../common/services/audit-log.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationModule } from '../notification/notification.module';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { TeamRecruitmentService } from './team-recruitment.service';

@Module({
  imports: [PrismaModule, AuditLogModule, ChatModule, NotificationModule],
  controllers: [TeamController],
  providers: [TeamService, TeamRecruitmentService],
  exports: [TeamService, TeamRecruitmentService],
})
export class TeamModule {}
