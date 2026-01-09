import { Module } from '@nestjs/common';
import { EssayAiService } from './essay-ai.service';
import { EssayAiController } from './essay-ai.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  providers: [EssayAiService],
  controllers: [EssayAiController],
  exports: [EssayAiService],
})
export class EssayAiModule {}



