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
import { AdminProgressGateway } from './admin-progress.gateway';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { AdminFeatureFlagController } from './admin-feature-flag.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { NotificationModule } from '../notification/notification.module';
import { SchoolModule } from '../school/school.module';
import { PredictionModule } from '../prediction/prediction.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    NotificationModule,
    SchoolModule,
    PredictionModule,
    AuthModule, // Provides JwtService for AdminProgressGateway
  ],
  controllers: [
    AdminController,
    AdminRoleController,
    AdminReviewController,
    AdminDataPipelineController,
    AdminHighSchoolController,
    AdminFeatureFlagController,
  ],
  providers: [
    AdminService,
    AdminDataSyncService,
    AdminRoleService,
    AdminOperatorService,
    AdminReviewService,
    AdminProgressGateway,
    PermissionGuard,
  ],
  exports: [AdminService, AdminReviewService],
})
export class AdminModule {}
