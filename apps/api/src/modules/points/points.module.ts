import { Module } from '@nestjs/common';
import { PointsService } from './incentive.service';
import { PointsConfigService } from './points-config.service';
import { PointsRedemptionService } from './points-redemption.service';
import { PointsAdminController } from './points-admin.controller';
import { PointsRedemptionController } from './points-redemption.controller';

@Module({
  controllers: [PointsAdminController, PointsRedemptionController],
  providers: [PointsService, PointsConfigService, PointsRedemptionService],
  exports: [PointsService, PointsConfigService, PointsRedemptionService],
})
export class PointsModule {}
