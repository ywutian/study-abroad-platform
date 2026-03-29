import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TimelineService } from './timeline.service';
import { TimelineApplicationService } from './timeline-application.service';
import { TimelinePersonalEventService } from './timeline-personal-event.service';
import { TimelineController } from './timeline.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { DeadlineReminderScheduler } from './deadline-reminder.scheduler';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), NotificationModule],
  providers: [
    TimelineApplicationService,
    TimelinePersonalEventService,
    TimelineService,
    DeadlineReminderScheduler,
  ],
  controllers: [TimelineController],
  exports: [TimelineService],
})
export class TimelineModule {}
