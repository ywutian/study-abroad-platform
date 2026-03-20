import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { RedisModule } from '../../common/redis/redis.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [RedisModule, PrismaModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
