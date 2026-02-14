import { Module, forwardRef } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { AiAgentModule } from '../ai-agent/ai-agent.module';
import { CaseModule } from '../case/case.module';

@Module({
  imports: [
    PrismaModule,
    AiModule,
    forwardRef(() => AiAgentModule),
    CaseModule,
  ],
  providers: [RecommendationService],
  controllers: [RecommendationController],
  exports: [RecommendationService],
})
export class RecommendationModule {}
