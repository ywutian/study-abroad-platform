import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AgentService, AgentController, ToolExecutor } from './agent';
import { PrismaModule } from '../../prisma/prisma.module';
import { PredictionModule } from '../prediction/prediction.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { ForumModule } from '../forum/forum.module';
import { SwipeModule } from '../swipe/swipe.module';
import { HallModule } from '../hall/hall.module';
import { RedisModule } from '../../common/redis/redis.module';
import { WebSearchService } from '../ai-agent/services/web-search.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    forwardRef(() => PredictionModule),
    forwardRef(() => AssessmentModule),
    forwardRef(() => ForumModule),
    forwardRef(() => SwipeModule),
    forwardRef(() => HallModule),
  ],
  controllers: [AiController, AgentController],
  providers: [AiService, AgentService, ToolExecutor, WebSearchService],
  exports: [AiService, AgentService, ToolExecutor, WebSearchService],
})
export class AiModule {}
