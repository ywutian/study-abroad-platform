import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';
import { PointsModule } from '../points/points.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PointsModule, NotificationModule],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
