import { Module } from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { TimelineController } from './timeline.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TimelineService],
  controllers: [TimelineController],
  exports: [TimelineService],
})
export class TimelineModule {}



