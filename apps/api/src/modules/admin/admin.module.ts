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
import { AdminPredictionWorkflowController } from './admin-prediction-workflow.controller';
import { AdminApplicationAnalysisWorkflowController } from './admin-application-analysis-workflow.controller';
import { AdminSchoolRatesController } from './admin-school-rates.controller';
import { AdminSchoolRatesService } from './admin-school-rates.service';
import { AdminCdsPipelineController } from './admin-cds-pipeline.controller';
import { AdminSchoolDataPipelineController } from './admin-school-data-pipeline.controller';
import { AdminSchoolDataCoverageService } from './admin-school-data-coverage.service';
import { AdminSchoolDataHealthService } from './admin-school-data-health.service';
import { AdminThemeStyleController } from './admin-theme-style.controller';
import { AdminCacheHealthController } from './admin-cache-health.controller';
import { AdminProfileReadinessDeliveryController } from './admin-profile-readiness-delivery.controller';
import { AdminProfileReadinessDeliveryService } from './admin-profile-readiness-delivery.service';
import { AdminEssayGalleryAIController } from './admin-essay-gallery-ai.controller';
import { AuditLogService } from '../../common/services/audit-log.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { NotificationModule } from '../notification/notification.module';
import { SchoolModule } from '../school/school.module';
import { PredictionModule } from '../prediction/prediction.module';
import { AuthModule } from '../auth/auth.module';
import { ProfileModule } from '../profile/profile.module';
import { EssayModule } from '../essay/essay.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    NotificationModule,
    SchoolModule,
    PredictionModule,
    ProfileModule,
    EssayModule,
    AuthModule, // Provides JwtService for AdminProgressGateway
  ],
  controllers: [
    AdminController,
    AdminRoleController,
    AdminReviewController,
    AdminDataPipelineController,
    AdminHighSchoolController,
    AdminFeatureFlagController,
    AdminPredictionWorkflowController,
    AdminApplicationAnalysisWorkflowController,
    AdminSchoolRatesController,
    AdminCdsPipelineController,
    AdminSchoolDataPipelineController,
    AdminThemeStyleController,
    AdminCacheHealthController,
    AdminProfileReadinessDeliveryController,
    AdminEssayGalleryAIController,
  ],
  providers: [
    AdminService,
    AdminDataSyncService,
    AdminRoleService,
    AdminOperatorService,
    AdminReviewService,
    AdminProgressGateway,
    AdminSchoolRatesService,
    AdminSchoolDataCoverageService,
    AdminSchoolDataHealthService,
    AdminProfileReadinessDeliveryService,
    AuditLogService,
    PermissionGuard,
  ],
  exports: [AdminService, AdminReviewService],
})
export class AdminModule {}
