import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AgentService, AgentController, ToolExecutor } from './agent';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { WebSearchService } from '../ai-agent/services/web-search.service';

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule],
  controllers: [AiController, AgentController],
  providers: [AiService, AgentService, ToolExecutor, WebSearchService],
  exports: [AiService, AgentService, ToolExecutor, WebSearchService],
})
export class AiModule {}
