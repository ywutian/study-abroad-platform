import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AgentService, AgentController, ToolExecutor } from './agent';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AiController, AgentController],
  providers: [AiService, AgentService, ToolExecutor],
  exports: [AiService, AgentService],
})
export class AiModule {}

