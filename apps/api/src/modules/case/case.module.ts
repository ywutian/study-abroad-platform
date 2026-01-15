import { Module, forwardRef } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseController } from './case.controller';
import { CaseIncentiveService } from './case-incentive.service';
import { AiAgentModule } from '../ai-agent/ai-agent.module';

@Module({
  imports: [forwardRef(() => AiAgentModule)],
  controllers: [CaseController],
  providers: [CaseService, CaseIncentiveService],
  exports: [CaseService, CaseIncentiveService],
})
export class CaseModule {}
