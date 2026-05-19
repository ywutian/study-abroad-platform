import { Module } from '@nestjs/common';
import { HallService } from './hall.service';
import { HallRankingService } from './hall-ranking.service';
import { HallListService } from './hall-list.service';
import { HallVerifiedService } from './hall-verified.service';
import { HallVerifiedDashboardService } from './hall-verified-dashboard.service';
import { HallOverviewService } from './hall-overview.service';
import { SwipeService } from './swipe.service';
import { HallController } from './hall.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';
import { PointsModule } from '../points/points.module';
import { SchoolListModule } from '../school-list/school-list.module';
import { NotificationModule } from '../notification/notification.module';

// Hall §7 Decision B: the peer-review subsystem (HallReviewService,
// ReviewerQualificationService, ReviewCoachService, HallAdminController)
// was retired and removed from this module.
@Module({
  imports: [
    PrismaModule,
    AiAgentMemoryModule,
    PointsModule,
    SchoolListModule,
    NotificationModule,
  ],
  controllers: [HallController],
  providers: [
    HallRankingService,
    HallListService,
    HallVerifiedService,
    HallVerifiedDashboardService,
    HallOverviewService,
    HallService,
    SwipeService,
  ],
  exports: [HallService, SwipeService, HallOverviewService],
})
export class HallModule {}
