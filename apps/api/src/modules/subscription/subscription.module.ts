import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { PaymentAdminController } from './payment-admin.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionController, PaymentAdminController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
