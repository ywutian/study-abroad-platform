import { Module } from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { TimelineApplicationService } from './timeline-application.service';
import { TimelinePersonalEventService } from './timeline-personal-event.service';
import { TimelineController } from './timeline.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    TimelineApplicationService,
    TimelinePersonalEventService,
    TimelineService,
  ],
  controllers: [TimelineController],
  exports: [TimelineService],
})
export class TimelineModule {}
