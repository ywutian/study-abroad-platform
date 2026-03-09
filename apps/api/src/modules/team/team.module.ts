import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../../common/services/audit-log.module';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
