import { Module } from '@nestjs/common';
import { HallService } from './hall.service';
import { HallRankingService } from './hall-ranking.service';
import { HallReviewService } from './hall-review.service';
import { HallListService } from './hall-list.service';
import { HallVerifiedService } from './hall-verified.service';
import { HallVerifiedDashboardService } from './hall-verified-dashboard.service';
import { HallOverviewService } from './hall-overview.service';
import { HallReviewAggregatorService } from './hall-review-aggregator.service';
import { ReviewerQualificationService } from './reviewer-qualification.service';
import { ReviewCoachService } from './review-coach.service';
import { SwipeService } from './swipe.service';
import { HallController } from './hall.controller';
import { HallAdminController } from './hall-admin.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';
import { PointsModule } from '../points/points.module';
import { SchoolListModule } from '../school-list/school-list.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    PrismaModule,
    AiAgentMemoryModule,
    PointsModule,
    SchoolListModule,
    NotificationModule,
  ],
  controllers: [HallController, HallAdminController],
  providers: [
    HallRankingService,
    HallReviewService,
    HallListService,
    HallVerifiedService,
    HallVerifiedDashboardService,
    HallOverviewService,
    HallReviewAggregatorService,
    ReviewerQualificationService,
    ReviewCoachService,
    HallService,
    SwipeService,
  ],
  exports: [
    HallService,
    SwipeService,
    HallOverviewService,
    HallReviewAggregatorService,
    ReviewerQualificationService,
    ReviewCoachService,
  ],
})
export class HallModule {}
