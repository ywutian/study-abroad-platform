import { Module, forwardRef } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseController } from './case.controller';
import { CaseAdminController } from './case-admin.controller';
import { CaseIncentiveService } from './case-incentive.service';
import { PointsConfigService } from './points-config.service';
import { PointsAdminController } from './points-admin.controller';
import { AiAgentModule } from '../ai-agent/ai-agent.module';

@Module({
  imports: [forwardRef(() => AiAgentModule)],
  controllers: [CaseController, CaseAdminController, PointsAdminController],
  providers: [CaseService, CaseIncentiveService, PointsConfigService],
  exports: [CaseService, CaseIncentiveService, PointsConfigService],
})
export class CaseModule {}
