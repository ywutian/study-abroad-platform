import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { DashboardService } from './dashboard.service';
import { PointsModule } from '../points/points.module';
import { PeerReviewModule } from '../peer-review/peer-review.module';

@Module({
  imports: [PointsModule, PeerReviewModule],
  controllers: [UserController],
  providers: [UserService, DashboardService],
  exports: [UserService, DashboardService],
})
export class UserModule {}
