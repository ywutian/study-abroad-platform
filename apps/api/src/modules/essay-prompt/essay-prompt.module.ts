import { Module } from '@nestjs/common';
import { EssayPromptService } from './essay-prompt.service';
import { EssayPromptController } from './essay-prompt.controller';
import { EssayPromptAdminController } from './essay-prompt-admin.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EssayPromptController, EssayPromptAdminController],
  providers: [EssayPromptService],
  exports: [EssayPromptService],
})
export class EssayPromptModule {}
