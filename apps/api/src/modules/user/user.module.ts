import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { DashboardService } from './dashboard.service';
import { AccountPurgeService } from './account-purge.service';
import { PointsModule } from '../points/points.module';
import { PeerReviewModule } from '../peer-review/peer-review.module';

@Module({
  imports: [ScheduleModule, PointsModule, PeerReviewModule],
  controllers: [UserController],
  providers: [UserService, DashboardService, AccountPurgeService],
  exports: [UserService, DashboardService],
})
export class UserModule {}
