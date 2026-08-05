import { Module } from '@nestjs/common';
import { SCHEDULE_MODULE_ROOT } from '../../common/cron/schedule-driver';
import { TimelineService } from './timeline.service';
import { TimelineApplicationService } from './timeline-application.service';
import { TimelinePersonalEventService } from './timeline-personal-event.service';
import { TimelineController } from './timeline.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { DeadlineReminderScheduler } from './deadline-reminder.scheduler';

@Module({
  imports: [PrismaModule, SCHEDULE_MODULE_ROOT, NotificationModule],
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
