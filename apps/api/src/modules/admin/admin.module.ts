import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminDataSyncService } from './admin-data-sync.service';
import { AdminRoleService } from './admin-role.service';
import { AdminRoleController } from './admin-role.controller';
import { AdminOperatorService } from './admin-operator.service';
import { AdminReviewService } from './admin-review.service';
import { AdminReviewController } from './admin-review.controller';
import { AdminDataPipelineController } from './admin-data-pipeline.controller';
import { AdminHighSchoolController } from './admin-high-school.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { NotificationModule } from '../notification/notification.module';
import { SchoolModule } from '../school/school.module';
import { PredictionModule } from '../prediction/prediction.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    NotificationModule,
    SchoolModule,
    PredictionModule,
  ],
  controllers: [
    AdminController,
    AdminRoleController,
    AdminReviewController,
    AdminDataPipelineController,
    AdminHighSchoolController,
  ],
  providers: [
    AdminService,
    AdminDataSyncService,
    AdminRoleService,
    AdminOperatorService,
    AdminReviewService,
  ],
  exports: [AdminService, AdminReviewService],
})
export class AdminModule {}
