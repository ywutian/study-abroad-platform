import { Module } from '@nestjs/common';
import { AssessmentService } from './assessment.service';
import { AssessmentController } from './assessment.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';

@Module({
  imports: [PrismaModule, AiAgentMemoryModule],
  providers: [AssessmentService],
  controllers: [AssessmentController],
  exports: [AssessmentService],
})
export class AssessmentModule {}
