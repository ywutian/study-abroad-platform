import { Module } from '@nestjs/common';
import { EssayAiService } from './essay-ai.service';
import { EssayAiController } from './essay-ai.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';
import { CaseModule } from '../case/case.module';

@Module({
  imports: [PrismaModule, AiModule, AiAgentMemoryModule, CaseModule],
  providers: [EssayAiService],
  controllers: [EssayAiController],
  exports: [EssayAiService],
})
export class EssayAiModule {}
