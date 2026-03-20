import { Module } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseController } from './case.controller';
import { CaseAdminController } from './case-admin.controller';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';
import { PointsModule } from '../points/points.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AiAgentMemoryModule, PointsModule, AdminModule],
  controllers: [CaseController, CaseAdminController],
  providers: [CaseService],
  exports: [CaseService],
})
export class CaseModule {}
