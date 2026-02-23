import { Module } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseController } from './case.controller';
import { CaseAdminController } from './case-admin.controller';
import { CaseIncentiveService } from './case-incentive.service';
import { PointsConfigService } from './points-config.service';
import { PointsAdminController } from './points-admin.controller';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';

@Module({
  imports: [AiAgentMemoryModule],
  controllers: [CaseController, CaseAdminController, PointsAdminController],
  providers: [CaseService, CaseIncentiveService, PointsConfigService],
  exports: [CaseService, CaseIncentiveService, PointsConfigService],
})
export class CaseModule {}
