import { Module, forwardRef } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { AiAgentModule } from '../ai-agent/ai-agent.module';

@Module({
  imports: [PrismaModule, AiModule, forwardRef(() => AiAgentModule)],
  providers: [RecommendationService],
  controllers: [RecommendationController],
  exports: [RecommendationService],
})
export class RecommendationModule {}
