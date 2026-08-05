import { Module } from '@nestjs/common';
import { SCHEDULE_MODULE_ROOT } from '../../../common/cron/schedule-driver';
import { NotificationModule } from '../../notification/notification.module';
import { PointsModule } from '../../points/points.module';
import { AdminOutcomeController } from './admin-outcome.controller';
import { OutcomeController } from './outcome.controller';
import { OutcomeReminderService } from './outcome-reminder.service';
import { OutcomeService } from './outcome.service';

/**
 * Outcome 模块 — M6: 让用户报告 Decision Day 录取结果
 *
 * 关联文档:
 *  - docs/PREDICTION_OUTCOME_COLLECTION_DESIGN.md
 *  - docs/PREDICTION_V2_DESIGN.md §9 (升级路径)
 *
 * 注意: PrismaService 来自全局 PrismaModule，无需此处显式导入。
 */
@Module({
  imports: [SCHEDULE_MODULE_ROOT, PointsModule, NotificationModule],
  controllers: [OutcomeController, AdminOutcomeController],
  providers: [OutcomeService, OutcomeReminderService],
  exports: [OutcomeService, OutcomeReminderService],
})
export class OutcomeModule {}
