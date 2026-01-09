import { Module } from '@nestjs/common';
import { AssessmentService } from './assessment.service';
import { AssessmentController } from './assessment.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AssessmentService],
  controllers: [AssessmentController],
  exports: [AssessmentService],
})
export class AssessmentModule {}



