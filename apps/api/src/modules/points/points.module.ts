import { Module } from '@nestjs/common';
import { CaseIncentiveService } from './incentive.service';
import { PointsConfigService } from './points-config.service';
import { PointsAdminController } from './points-admin.controller';

@Module({
  controllers: [PointsAdminController],
  providers: [CaseIncentiveService, PointsConfigService],
  exports: [CaseIncentiveService, PointsConfigService],
})
export class PointsModule {}
