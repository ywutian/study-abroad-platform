import { Module } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseQueryService } from './case-query.service';
import { CaseBatchService } from './case-batch.service';
import { CaseMemoryService } from './case-memory.service';
import { CaseSimilarityService } from './case-similarity.service';
import { CaseController } from './case.controller';
import { CaseAdminController } from './case-admin.controller';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';
import { PointsModule } from '../points/points.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AiAgentMemoryModule, PointsModule, AdminModule],
  controllers: [CaseController, CaseAdminController],
  providers: [
    CaseService,
    CaseQueryService,
    CaseBatchService,
    CaseMemoryService,
    CaseSimilarityService,
  ],
  exports: [CaseService, CaseSimilarityService],
})
export class CaseModule {}
