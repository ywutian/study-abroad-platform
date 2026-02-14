import { Module, forwardRef } from '@nestjs/common';
import { EssayAiService } from './essay-ai.service';
import { EssayAiController } from './essay-ai.controller';
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
  providers: [EssayAiService],
  controllers: [EssayAiController],
  exports: [EssayAiService],
})
export class EssayAiModule {}
